import {expect} from 'chai'
const basename = __dirname.split('/').reverse()[0]

@annotated
@size('grande')
class MyClass {
  constructor (opt) {
    this._opt = opt
  }

  @bind('nyan')
  doSomething (arg) {
    return arg
  }
}

describe(`${basename}-Decorator on class declaration`, () => {
  it('should modify class constructor', () => {
    expect(MyClass.isAnnotated).to.be.true
  })

  it('should be a expression', () => {
    expect(MyClass.size).to.equal('grande')
  })
})

describe(`${basename}-Decorator on method of class declaration`, () => {
  it('should replace method itself', () => {
    const myObj = new MyClass()
    expect(myObj.doSomething()).to.equal('nyan')
  })
})

function annotated (classObj) {
  classObj.isAnnotated = true
}

function size (sizeName) {
  return function size (classObj) {
    classObj.size = sizeName
  }
}

function bind (...args) {
  return function bind (proto, name, descriptor) {
    const origin = descriptor.value
    descriptor.value = function (...args2) {
      return origin.call(this, ...args, ...args2)
    }
  }
}
