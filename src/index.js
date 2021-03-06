import template from 'babel-template'

const HAS_CLASS_DECORATOR = Symbol('hasClassDecorator')
const HAS_METHOD_DECORATOR = Symbol('hasMethodDecorator')
const HELPER_CLASS_DECORATOR = Symbol('helperClassDecorator')
const HELPER_METHOD_DECORATOR = Symbol('helperMethodDecorator')

const ERR_INVALID_METHOD_DECO =
  'Decorator cannot be attached to constructor nor computed method'

const buildClassDecoratorHelperFunction = template(`
  function FUNCTION_NAME (classObj, decorators) {
    return decorators.reduceRight(function (classObj, decorator) {
      return decorator(classObj) || classObj
    }, classObj)
  }
`)

const buildMethodDecoratorHelperFunction = template(`
  function FUNCTION_NAME (classObj, methodName, decorators) {
    var proto = classObj.prototype
    var descriptor = decorators.reduceRight(function (descriptor, decorator) {
      return decorator(proto, methodName, descriptor) || descriptor
    }, Object.getOwnPropertyDescriptor(proto, methodName))
    descriptor && Object.defineProperty(proto, methodName, descriptor)
  }
`)

function collectDecoratedMethods (t, path, state, node, data) {
  node = node || path.node

  if (path._decoratedMethods) return path._decoratedMethods

  // collect all decorated methods
  const decoratedMethods = []
  const methodNameSet = new Set()
  for (let maybeMethod of node.body.body) {
    // ignore other then methods
    if (!t.isClassMethod(maybeMethod)) continue

    // constructor and computed named methods cannot have decorators
    const {key, kind, computed, decorators} = maybeMethod
    if (kind === 'constructor' || computed) {
      if (decorators && decorators.length) {
        throw path.buildCodeFrameError(ERR_INVALID_METHOD_DECO)
      }
      continue
    }

    // ignore non-decorated methods
    if (!decorators || !decorators.length) continue

    // remove decorators from original node
    delete maybeMethod.decorators

    const {name} = key
    // check if decoratedMethods has the same named method
    // ex) both getter and setter are decorated
    if (methodNameSet.has(name)) {
      const existingMethod = decoratedMethods.find(method => {
        return method.name === name
      })
      existingMethod.decorators =
        existingMethod.decorators.concat(decorators)
    } else {
      methodNameSet.add(name)
      decoratedMethods.push({name, decorators})
    }
  }

  path._decoratedMethods = decoratedMethods
  return decoratedMethods
}

function processPureClassDeclaration (t, path, state, node) {
  node = node || path.node

  // mark as parsed to prevent recursion
  node._parsedDecorators = true

  const decoratedMethods = collectDecoratedMethods(t, path, state, node)

  // this class doesn't have method decorators
  if (!decoratedMethods.length) {
    return [node]
  }

  state.set(HAS_METHOD_DECORATOR, true)
  const methodHelperRef = state.get(HELPER_METHOD_DECORATOR)
  const nodes = [node]
  for (let method of decoratedMethods) {
    const methodDecorators = method.decorators.map(dec => dec.expression)
    nodes.push(t.expressionStatement(
      t.callExpression(methodHelperRef, [
        node.id,
        t.stringLiteral(method.name),
        t.arrayExpression(methodDecorators)
      ])
    ))
  }

  return nodes
}

function processClassExpression (t, path, state, node) {
  node = node || path.node

  delete node.decorators

  const decoratedMethods = collectDecoratedMethods(t, path, state, node)

  if (!decoratedMethods.length) {
    return node
  }

  const {id, superClass, body} = node
  const classId = id || path.scope.generateUidIdentifier('anonymousClass')
  const declaration =
    t.classDeclaration(classId, superClass, body, [])
  const processedDeclarations =
    processPureClassDeclaration(t, path, state, declaration)
  const declarationId = processedDeclarations[0].id

  return t.callExpression(
    t.functionExpression(null, [], t.blockStatement([
      ...processedDeclarations,
      t.returnStatement(declarationId)
    ])),
    []
  )
}

function processClassDeclaration (t, path, state, node) {
  node = node || path.node

  const {id, superClass, body, decorators} = node
  if (!decorators || !decorators.length) {
    return processPureClassDeclaration(t, path, state, node)
  }

  state.set(HAS_CLASS_DECORATOR, true)
  const classHelperRef = state.get(HELPER_CLASS_DECORATOR)

  const expression = t.classExpression(id, superClass, body, [])
  const decoratorExpressions = decorators.map(dec => dec.expression)
  return [t.variableDeclaration('let', [
    t.variableDeclarator(node.id, t.callExpression(classHelperRef, [
      processClassExpression(t, path, state, expression),
      t.arrayExpression(decoratorExpressions)
    ]))
  ])]
}

module.exports = function ({types: t}) {
  return {
    visitor: {
      Program: {
        enter (path, state) {
          const {scope} = path
          const helperClass = scope.generateUidIdentifier('classDecorator')
          const helperMethod = scope.generateUidIdentifier('methodDecorator')

          state.set(HELPER_CLASS_DECORATOR, helperClass)
          state.set(HELPER_METHOD_DECORATOR, helperMethod)
        },

        exit (path, state) {
          const body = path.node.body
          if (state.has(HAS_CLASS_DECORATOR)) {
            body.push(buildClassDecoratorHelperFunction({
              FUNCTION_NAME: state.get(HELPER_CLASS_DECORATOR)
            }))
          }
          if (state.has(HAS_METHOD_DECORATOR)) {
            body.push(buildMethodDecoratorHelperFunction({
              FUNCTION_NAME: state.get(HELPER_METHOD_DECORATOR)
            }))
          }
        }
      },

      ClassDeclaration (path, state) {
        if (path.node._parsedDecorators) return

        const nodes = processClassDeclaration(t, path, state)
        if (path.parentPath.node.type.startsWith('Export')) {
          if (nodes.length > 1) {
            path.parentPath.insertAfter(nodes.slice(1))
          }
          path.replaceWith(nodes[0])
          return
        }
        path.replaceWithMultiple(nodes)
      },

      ClassExpression (path, state) {
        path.replaceWith(processClassExpression(t, path, state))
      }
    }
  }
}
