// ==ClosureCompiler==
// @output_file_name formdata.min.js
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==

if (!window.FormData || !window.FormData.prototype.keys || !('set' in window.FormData)) {

  // keep a reference to native implementation
  const _FormData = window.FormData

  // To be monkey patched
  const _send = window.XMLHttpRequest.prototype.send
  const _fetch = window.Request && window.fetch

  // Unable to patch Request constructor correctly
  // const _Request = window.Request
  // only way is to use ES6 class extend
  // https://github.com/babel/babel/issues/1966

  const stringTag = window.Symbol && Symbol.toStringTag
  const map = new WeakMap
  const wm = o => map.get(o)
  const type = obj => Object.prototype.toString.call(obj).slice(8, -1)
  const arrayFrom = Array.from || (obj => [].slice.call(obj))

  // Add missing stringTags to blob and files
  if (stringTag) {
    if (!Blob.prototype[stringTag]) {
      Blob.prototype[stringTag] = 'Blob'
    }

    if ('File' in window && !File.prototype[stringTag]) {
      File.prototype[stringTag] = 'File'
    }
  }

  // Fix so you can construct your own File
  try {
    new File([], '')
  } catch (a) {
    window.File = function(b, d, c) {
      const blob = new Blob(b, c)
      const t = c && void 0 !== c.lastModified ? new Date(c.lastModified) : new Date

      Object.defineProperties(blob, {
        name: {
          value: d
        },
        lastModifiedDate: {
          value: t
        },
        lastModified: {
          value: +t
        },
        toString: {
          value: function () {
            return '[object File]'
          }
        }
      })

      if (stringTag) {
        Object.defineProperty(blob, stringTag, {
          value: 'File'
        })
      }

      return blob
    }
  }

  function normalizeValue([value, filename]) {
    if (value instanceof Blob)
      // Should always returns a new File instance
      // console.assert(fd.get(x) !== fd.get(x))
      value = new File([value], filename, {
        type: value.type,
        lastModified: value.lastModified
      })

    return value
  }

  function stringify(name) {
    if (!arguments.length)
      throw new TypeError('1 argument required, but only 0 present.')

    return [name + '']
  }

  function normalizeArgs(name, value, filename) {
    if (arguments.length < 2)
      throw new TypeError(
        `2 arguments required, but only ${arguments.length} present.`
      )

    return value instanceof Blob
      // normalize name and filename if adding an attachment
      ? [name + '', value, filename !== undefined
        ? filename + '' // Cast filename to string if 3th arg isn't undefined
        : type(value) === 'File' // if it's a File
          ? value.name // Use File.name
          : 'Blob'] // otherwise fallback to Blob

      // If no attachment, just cast the args to strings
      : [name + '', value + '']
  }

  /**
   * @implements {Iterable}
   */
  class FormDataPolyfill {

    /**
     * FormData class
     *
     * @param {HTMLElement=} form
     */
    constructor(form) {
      map.set(this, Object.create(null))

      if (!form)
        return this

      for (let {name, type, value, files, checked, selectedOptions} of arrayFrom(form.elements)) {
        if(!name) continue

        if (type === 'file')
          for (let file of files)
            this.append(name, file)
        else if (type === 'select-multiple' || type === 'select-one')
          for (let elm of arrayFrom(selectedOptions))
            this.append(name, elm.value)
        else if (type === 'checkbox' || type === 'radio') {
          if (checked) this.append(name, value)
        } else
          this.append(name, value)
      }
    }


    /**
     * Append a field
     *
     * @param   {String}           name      field name
     * @param   {String|Blob|File} value     string / blob / file
     * @param   {String=}          filename  filename to use with blob
     * @return  {Undefined}
     */
    append(name, value, filename) {
      const map = wm(this)

      if (!map[name])
        map[name] = []

      map[name].push([value, filename])
    }


    /**
     * Delete all fields values given name
     *
     * @param   {String}  name  Field name
     * @return  {Undefined}
     */
    delete(name) {
      delete wm(this)[name]
    }


    /**
     * Iterate over all fields as [name, value]
     *
     * @return {Iterator}
     */
    *entries() {
      const map = wm(this)

      for (let name in map)
        for (let value of map[name])
          yield [name, normalizeValue(value)]
    }

    /**
     * Iterate over all fields
     *
     * @param   {Function}  callback  Executed for each item with parameters (value, name, thisArg)
     * @param   {Object=}   thisArg   `this` context for callback function
     * @return  {Undefined}
     */
    forEach(callback, thisArg) {
      for (let [name, value] of this)
        callback.call(thisArg, value, name, this)
    }


    /**
     * Return first field value given name
     * or null if non existen
     *
     * @param   {String}  name      Field name
     * @return  {String|File|null}  value Fields value
     */
    get(name) {
      const map = wm(this)
      return map[name] ? normalizeValue(map[name][0]) : null
    }


    /**
     * Return all fields values given name
     *
     * @param   {String}  name  Fields name
     * @return  {Array}         [{String|File}]
     */
    getAll(name) {
      return (wm(this)[name] || []).map(normalizeValue)
    }


    /**
     * Check for field name existence
     *
     * @param   {String}   name  Field name
     * @return  {boolean}
     */
    has(name) {
      return name in wm(this)
    }


    /**
     * Iterate over all fields name
     *
     * @return {Iterator}
     */
    *keys() {
      for (let [name] of this)
        yield name
    }


    /**
     * Overwrite all values given name
     *
     * @param   {String}    name      Filed name
     * @param   {String}    value     Field value
     * @param   {String=}   filename  Filename (optional)
     * @return  {Undefined}
     */
    set(name, value, filename) {
      wm(this)[name] = [[value, filename]]
    }


    /**
     * Iterate over all fields
     *
     * @return {Iterator}
     */
    *values() {
      for (let [name, value] of this)
        yield value
    }


    /**
     * Non standard but it has been proposed: https://github.com/w3c/FileAPI/issues/40
     *
     * @return {ReadableStream}
     */
    stream() {
      try {
        return this['_blob']().stream()
      } catch(e) {
        throw new Error('Include https://github.com/jimmywarting/Screw-FileReader for streaming support')
      }
    }


    /**
     * Return a native (perhaps degraded) FormData with only a `append` method
     * Can throw if it's not supported
     *
     * @return {FormData}
     */
    ['_asNative']() {
      const fd = new _FormData

      for (let [name, value] of this)
        fd.append(name, value)

      return fd
    }


    /**
     * [_blob description]
     *
     * @return {Blob} [description]
     */
    ['_blob']() {
      const boundary = '----formdata-polyfill-' + Math.random()
      const chunks = []

      for (let [name, value] of this) {
        chunks.push(`--${boundary}\r\n`)

        if (value instanceof Blob) {
          chunks.push(
            `Content-Disposition: form-data; name="${name}"; filename="${value.name}"\r\n`,
            `Content-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`,
            value,
            '\r\n'
          )
        } else {
          chunks.push(
            `Content-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
          )
        }
      }

      chunks.push(`--${boundary}--`)

      return new Blob(chunks, {type: 'multipart/form-data; boundary=' + boundary})
    }


    /**
     * The class itself is iterable
     * alias for formdata.entries()
     *
     * @return  {Iterator}
     */
    [Symbol.iterator]() {
      return this.entries()
    }


    /**
     * Create the default string description.
     *
     * @return  {String} [object FormData]
     */
    toString() {
      return '[object FormData]'
    }
  }


  /**
   * Create the default string description.
   * It is accessed internally by the Object.prototype.toString().
   *
   * @return {String} FormData
   */
  if (stringTag) {
    FormDataPolyfill.prototype[stringTag] = 'FormData'
  }

  for (let [method, decorator] of [
    ['append', normalizeArgs],
    ['delete', stringify],
    ['get',    stringify],
    ['getAll', stringify],
    ['has',    stringify],
    ['set',    normalizeArgs]
  ]) {
    let orig = FormDataPolyfill.prototype[method]
    FormDataPolyfill.prototype[method] = function() {
      return orig.apply(this, decorator(...arguments))
    }
  }

  // Patch xhr's send method to call _blob transparently
  XMLHttpRequest.prototype.send = function(data) {
    _send.call(this, data instanceof FormDataPolyfill ? data['_blob']() : data)
  }

  // Patch fetch's function to call _blob transparently
  if (_fetch) {
    const _fetch = window.fetch

    window.fetch = function(input, init) {
      if (init && init.body && init.body instanceof FormDataPolyfill) {
        init.body = init.body['_blob']()
      }

      return _fetch(input, init)
    }
  }

  window['FormData'] = FormDataPolyfill
}
