import template from 'babel-template'

const HAS_CLASS_DECORATOR = Symbol('hasClassDecorator')
const HAS_METHOD_DECORATOR = Symbol('hasMethodDecorator')
const HELPER_CLASS_DECORATOR = Symbol('helperClassDecorator')
const HELPER_METHOD_DECORATOR = Symbol('helperMethodDecorator')
const DECORATED_METHODS = Symbol('decoratedMethods')

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

export default function ({types: t}) {
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
      ClassDeclaration: {
        enter (path, state) {
          const expression = processClassAndGetExpression(t, path, state)
          if (!expression) return

          path.replaceWith(t.variableDeclaration('let', [
            t.variableDeclarator(path.node.id, expression)
          ]))
        },
        exit (path, state) {
          const statements = processMethodsAndGetStatements(t, path, state)
          if (!statements) return
          path.replaceWithMultiple(statements)
        }
      },
      ClassExpression: {
        enter (path, state) {
          const expression = processClassAndGetExpression(t, path, state)
          if (!expression) return
          path.replaceWith(expression)
        },
        exit (path, state) {
          const statements = processMethodsAndGetStatements(t, path, state)
          if (!statements) return
          path.replaceWith(t.callExpression(
            t.functionExpression(null, [], t.blockStatement(statements)),
            []
          ))
        }
      },
      Class (path, state) {
        const prev = state.get(DECORATED_METHODS)
        const methods = []
        methods.prev = prev
        state.set(DECORATED_METHODS, methods)
      },
      ClassMethod (path, state) {
        const {node} = path
        const {key, kind, decorators} = node
        if (!decorators ||
            !decorators.length ||
            !t.isIdentifier(key) ||
            node.computed ||
            node.static ||
            kind === 'constructor') return
        node.decorators = []

        const methods = state.get(DECORATED_METHODS)
        methods.push({key, kind, decorators})
      }
    }
  }
}

function processClassAndGetExpression (t, path, state) {
  const {node} = path
  const {id, superClass, body, decorators} = node
  if (!decorators || !decorators.length) return
  node.decorators = []

  state.set(HAS_CLASS_DECORATOR, true)
  const classHelperRef = state.get(HELPER_CLASS_DECORATOR)

  const decoratorExpressions = decorators.map(dec => dec.expression)
  return t.callExpression(classHelperRef, [
    t.classExpression(id, superClass, body, []),
    t.arrayExpression(decoratorExpressions)
  ])
}

function processMethodsAndGetStatements (t, path, state) {
  const {node: {id, superClass, body}, scope} = path
  const classId = id || scope.generateUidIdentifier('anonymouseClass')

  const decoratedMethods = state.get(DECORATED_METHODS)
  state.set(DECORATED_METHODS, decoratedMethods.prev)
  if (!decoratedMethods.length) return

  state.set(HAS_METHOD_DECORATOR, true)
  const methodHelperRef = state.get(HELPER_METHOD_DECORATOR)

  const history = new Set()
  return decoratedMethods
    .reduce((prev, {key: {name}, decorators}) => {
      if (!history.has(name)) {
        history.add(name)
        prev.push(t.expressionStatement(
          t.callExpression(methodHelperRef, [
            classId,
            t.stringLiteral(name),
            t.arrayExpression(decorators.map(dec => dec.expression))
          ])
        ))
      }
      return prev
    }, [t.classDeclaration(classId , superClass, body, [])])
    .concat([t.returnStatement(classId)])
}
