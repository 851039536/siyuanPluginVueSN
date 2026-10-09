import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    stylistic: {
      indent: 2, // 4, or 'tab'
      quotes: 'single', // or 'double'
    },

    vue: true,
    typescript: true,

    formatters: true,

    ignores: [
      'dist',
      'node_modules',
      '.agents',
    ],
  },
  {
    files: [
      'src/**/*.vue',
    ],
    rules: {
    },
  },
  {
    files: [
      'src/**/*.ts',
    ],
    rules: {
    },
  },
  {
    rules: {
      'antfu/top-level-function': 'off',
      'antfu/if-newline': 'off',

      'eqeqeq': 'off',

      'no-console': 'warn',
      'no-empty': 'off',

      'object-curly-newline': ['error', {
        multiline: true,
        minProperties: 2,
        consistent: true,
      }],
      'object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false,
      }],

      'style/arrow-parens': ['warn', 'always'],
      'style/brace-style': 'off',
      'style/no-multiple-empty-lines': ['warn', {
        max: 7,
      }],
      'style/operator-linebreak': ['warn', 'before', {
        overrides: {
          '=': 'ignore',
        },
      }],
      'style/padded-blocks': 'off',
      'style/quotes': 'off',

      'ts/consistent-type-imports': 'off',
      'ts/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
      'ts/no-require-imports': 'off',
      'ts/no-use-before-define': 'warn',
      'ts/prefer-literal-enum-member': 'off',
      'ts/strict-boolean-expressions': 'off',

      'unused-imports/no-unused-vars': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unicorn/prefer-dom-node-text-content': 'off',

      'format/prettier': 'off',

      'regexp/optimal-quantifier-concatenation': 'warn',
      'regexp/no-super-linear-backtracking': 'warn',
      'regexp/no-unused-capturing-group': 'warn',

      'style/comma-dangle': ['error', 'always-multiline'],

      'vue/block-order': ['warn', {
        order: ['template', 'script', 'style'],
      }],
      'vue/block-tag-newline': 'off',

      'vue/eqeqeq': ['warn', 'smart'],

      'vue/first-attribute-linebreak': ['warn', {
        multiline: 'below',
      }],
      "vue/no-mutating-props": ["error", {
        shallowOnly: true,
      }],
      'vue/max-attributes-per-line': ['error', {
        singleline: {
          max: 1,
        },
        multiline: {
          max: 1,
        },
      }],
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',

      'vue/html-self-closing': 'off',
      'vue/multiline-html-element-content-newline': 'off',

      'vue/valid-template-root': 'off',

      'vue/object-curly-newline': ['error', {
        multiline: true,
        minProperties: 2,
        consistent: true,
      }],
      'vue/object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false,
      }],
    },
  },
  // 必须置于全局块之后：扁平配置中后面的块覆盖前面的，放在前面会被全局规则盖掉
  {
    // scripts/ 下是 Node 命令行脚本（ESM 单文件工具），与前端业务代码的约束错配：
    // - 脚本的唯一产出就是 stdout，禁止 console 等于禁止其功能
    // - `node/prefer-global/process` 会建议改用 `require("process")`，而 .mjs 中无 require，该建议不成立
    // - 小对象（如 `{ file, line, kind }`）单行书写更易读，不套用业务代码的强制换行
    // - 这些是纯 JS 文件，无类型标注可写
    files: [
      'scripts/**/*.mjs',
    ],
    rules: {
      'no-console': 'off',
      'node/prefer-global/process': 'off',
      'object-curly-newline': 'off',
      'object-property-newline': 'off',
      'ts/explicit-function-return-type': 'off',
    },
  },
)
