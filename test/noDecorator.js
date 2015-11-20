import {expect} from 'chai'
const basename = __dirname.split('/').reverse()[0]

import Event from 'events'

export class MyClass extends Event {
  constructor () {
    super()
  }

  doSomething () {
    return 'nyan'
  }
}

describe(`${basename}-Plain class without decorators`, () => {
  it('should not be changed', () => {
    const myObj = new MyClass()
    expect(myObj.doSomething()).to.equal('nyan')
  })
})
