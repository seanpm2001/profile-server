module.exports = {
    extends: ['airbnb', 'plugin:security/recommended', "eslint:recommended",
        "plugin:react/recommended"],
    env: {
        node: true,
        "jest/globals": true
    },
    plugins: ['security', 'notice', 'jest'],
    globals: {
        it: true,
        describe: true,
        before: true,
        after: true,
        TimeRange: true,
        BarChart: true,
        PieChart: true,
        AnalyticProcessor: true,
        SerialChart: true,
        ProcessorConfiguration: true,
        CommonStages: true,
        Dashboard: true
    },
    rules: {
        'lines-between-class-members': 0,
        'import/order': 0,
        'max-classes-per-file': 0,
        'object-shorthand': 0,
        'global-require': 0,
        'no-underscore-dangle': 0,
        'prefer-destructuring': 0,
        'linebreak-style': 0,
        'prefer-template': 0,
        'spaced-comment': 1,
        'import/newline-after-import': 0,
        'func-names': 0,
        'arrow-parens': 0,
        'space-before-function-paren': 0,
        'max-len': 0,
        'new-cap': 0,
        'vars-on-top': 0,
        'no-plusplus': 0,
        'guard-for-in': 0,
        'no-console': 0,
        'no-unused-vars': 0,
        'no-shadow': 0,
        'no-param-reassign': 0,
        camelcase: 0,
        'no-restricted-syntax': 0,
        'no-multiple-empty-lines': 0,
        'consistent-return': 0,
        'object-curly-newline': 0,
        'no-await-in-loop': 0,
        'prefer-const': ['warn'],
        'security/detect-object-injection': 0,
        'class-methods-use-this': 0,
        'no-empty': 0,
        indent: ['error', 4],
        "notice/notice": ["error",
            {
                "templateFile": "./license.js",
                "onNonMatchingHeader": "replace"
            }
        ]
    },
};
