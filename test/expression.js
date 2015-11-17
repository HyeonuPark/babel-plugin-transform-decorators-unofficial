import {expect} from 'chai'

const MyClass = class {
  constructor (opt) {
    this._opt = opt
  }

  @bind('nyan')
  doSomething (arg) {
    return arg
  }
}

describe('Decorator on method of class expression', () => {
  it('should replace method itself', () => {
    const myObj = new MyClass()
    expect(myObj.doSomething()).to.equal('nyan')
  })
})

function bind (...args) {
  return function bind (proto, name, descriptor) {
    const origin = descriptor.value
    descriptor.value = function (...args2) {
      return origin.call(this, ...args, ...args2)
    }
  }
}
