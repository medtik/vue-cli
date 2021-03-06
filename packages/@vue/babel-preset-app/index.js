const path = require('path')

const defaultPolyfills = [
  'es6.promise'
]

function getPolyfills (targets, includes, { ignoreBrowserslistConfig, configPath }) {
  const { isPluginRequired } = require('@babel/preset-env')
  const builtInsList = require('@babel/preset-env/data/built-ins.json')
  const getTargets = require('@babel/preset-env/lib/targets-parser').default
  const builtInTargets = getTargets(targets, {
    ignoreBrowserslistConfig,
    configPath
  })

  return includes.filter(item => {
    return isPluginRequired(builtInTargets, builtInsList[item])
  })
}

module.exports = (context, options = {}) => {
  const presets = []
  const plugins = []

  // JSX
  if (options.jsx !== false) {
    plugins.push(
      require('@babel/plugin-syntax-jsx'),
      require('babel-plugin-transform-vue-jsx')
      // require('babel-plugin-jsx-event-modifiers'),
      // require('babel-plugin-jsx-v-model')
    )
  }

  const {
    polyfills: userPolyfills,
    loose = false,
    useBuiltIns = 'usage',
    modules = false,
    targets: rawTargets,
    spec,
    ignoreBrowserslistConfig,
    configPath,
    include,
    exclude,
    shippedProposals,
    forceAllTransforms,
    decoratorsLegacy
  } = options

  const targets = process.env.VUE_CLI_BABEL_TARGET_NODE
    ? { node: 'current' }
    : process.env.VUE_CLI_MODERN_BUILD
      ? { esmodules: true }
      : rawTargets

  // included-by-default polyfills. These are common polyfills that 3rd party
  // dependencies may rely on (e.g. Vuex relies on Promise), but since with
  // useBuiltIns: 'usage' we won't be running Babel on these deps, they need to
  // be force-included.
  let polyfills
  const buildTarget = process.env.VUE_CLI_TARGET || 'app'
  if (
    buildTarget === 'app' &&
    useBuiltIns === 'usage' &&
    !process.env.VUE_CLI_BABEL_TARGET_NODE &&
    !process.env.VUE_CLI_MODERN_BUILD
  ) {
    polyfills = getPolyfills(targets, userPolyfills || defaultPolyfills, {
      ignoreBrowserslistConfig,
      configPath
    })
    plugins.push([require('./polyfillsPlugin'), { polyfills }])
  } else {
    polyfills = []
  }

  const envOptions = {
    spec,
    loose,
    modules,
    targets,
    useBuiltIns,
    ignoreBrowserslistConfig,
    configPath,
    include,
    exclude: polyfills.concat(exclude || []),
    shippedProposals,
    forceAllTransforms
  }

  // cli-plugin-jest sets this to true because Jest runs without bundling
  if (process.env.VUE_CLI_BABEL_TRANSPILE_MODULES) {
    envOptions.modules = 'commonjs'
    // necessary for dynamic import to work in tests
    plugins.push(require('babel-plugin-dynamic-import-node'))
  }

  // pass options along to babel-preset-env
  presets.push([require('@babel/preset-env'), envOptions])

  // stage 2. This includes some important transforms, e.g. dynamic import
  // and rest object spread.
  presets.push([require('@babel/preset-stage-2'), {
    loose,
    useBuiltIns: useBuiltIns !== false,
    decoratorsLegacy: decoratorsLegacy !== false
  }])

  // transform runtime, but only for helpers
  plugins.push([require('@babel/plugin-transform-runtime'), {
    polyfill: false,
    regenerator: useBuiltIns !== 'usage',
    useBuiltIns: useBuiltIns !== false,
    useESModules: !process.env.VUE_CLI_BABEL_TRANSPILE_MODULES,
    moduleName: path.dirname(require.resolve('@babel/runtime/package.json'))
  }])

  return {
    presets,
    plugins
  }
}
