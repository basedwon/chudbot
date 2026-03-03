class AxiosStub {
  constructor(axios) {
    this.axios = axios
    this.original = {}
    this.calls = { get: [], post: [] }
  }
  stubGet(impl) {
    if (!this.original.get)
      this.original.get = this.axios.get
    this.axios.get = async (...args) => {
      this.calls.get.push(args)
      return impl(...args)
    }
  }
  stubPost(impl) {
    if (!this.original.post)
      this.original.post = this.axios.post
    this.axios.post = async (...args) => {
      this.calls.post.push(args)
      return impl(...args)
    }
  }
  restore() {
    if (this.original.get)
      this.axios.get = this.original.get
    if (this.original.post)
      this.axios.post = this.original.post
    this.original = {}
  }
}

function createAxiosStub(axios) {
  return new AxiosStub(axios)
}

module.exports = {
  createAxiosStub
}
