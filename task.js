#!/usr/bin/env node

var sys = require("sys")
var exec = require("child_process").exec

exports.tasks = {}

exports.define = function (name) {
  var callback = arguments[arguments.length - 1]

  switch(arguments.length) {
    case 2:
      exports.tasks[name]   = callback
      callback.dependencies = []
      break
    case 3:
      if (arguments[1] instanceof Array) {
        callback.description  = arguments[1]
        callback.dependencies = []
      } else {
        callback.dependencies = arguments[1]
      }
      exports.tasks[name] = callback
      break
    case 4:
      callback.description  = arguments[1]
      callback.dependencies = arguments[2]
      exports.tasks[name]   = callback
      break
    default:
      throw("Unexpected arguments: " + sys.inspect(arguments))
      break
  }
}

exports.exec = function(task, args) {
  var callback = exports.tasks[task]
  try {
    if (callback instanceof Function) {
      sys.puts("~ Invoking task " + task)
      for (var index = 0; index < callback.dependencies.length; index++) {
        var dependency = callback.dependencies[index]
        exports.exec(dependency, args)
      }
      sys.puts("~ Executing task " + task)
      callback(args) // TODO: splat
    } else {
      sys.puts("Task " + task + " doesn't have a callback (" + sys.inspect(callback) + " returned)")
      process.exit(1)
    }
  } catch(exception) {
    sys.puts("Exception occured during running task " + task + ":")
    sys.puts(exception.stack)
    process.exit(1)
  }
}

exports.run = function () {
  var argv = process.ARGV
  var args = argv.slice(2, argv.length)
  var task = args.shift() || "default"
  exports.exec(task, args)
}

// Helpers

var chain = [], busy = false;

exports.sh = function(command, callback) {
  var cmd = (typeof command == 'string') ? [command] : command
  if (typeof callback == 'function') cmd.push(callback)
  if (busy) return chain.push(cmd)
  busy = true
  var shell = process.ENV["SHELL"] || "sh"
  sys.puts("[" + shell + "] " + cmd[0])
  exec(shell + " -c " + cmd[0], function (error, stdout, stderr) {
    busy = false
    sys.puts(error === null ? stdout : error)
    if (cmd[1]) cmd[1](error, stdout, stderr)
    if (chain.length) exports.sh(chain.pop())
  })
}

// Built-in Tasks

// show generic help
exports.define("-H", function() {
  sys.puts("=== Help ===")
  var parts = process.ARGV[1].split("/")
  var executable = "./" + parts[parts.length - 1]
  sys.puts("Usage: " + executable + " [task] [arguments] [options]\n")
  sys.puts("Examples:")
  var option = function(executable, description) {
    sys.puts("  " + executable + description)
  }
  process.exit(1)
})

// show all available tasks include description and dependencies
exports.define("-T", function() {
  sys.puts("=== Tasks ===")
  for (var property in exports.tasks) {
    if (!(exports.tasks[property] instanceof Function)) {
      var task = exports.tasks[property]
      var description  = exports.tasks[task].description
      var dependencies = exports.tasks[task].dependencies
      sys.puts(task + "  " + (description || "no description") + " [" + dependencies.join(", ") + "]")
    }
  }
})