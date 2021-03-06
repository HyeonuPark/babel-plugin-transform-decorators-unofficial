import gulp from 'gulp'
import standard from 'gulp-standard'
import mocha from 'gulp-mocha'
import babel from 'gulp-babel'
import del from 'del'

import thisModule from './src/index.js'

gulp.task('default', ['lint', 'test'])

gulp.task('clear', () => {
  return del(['bin/**', 'bin_*/**', 'tmp/**'])
})

gulp.task('build', ['buildSrc', 'buildTestNode', 'buildTestBrowser'])

gulp.task('buildSrc', ['clear'], () => {
  return gulp.src('src/**/*.js')
    .pipe(babel({
      plugins: [
        'transform-strict-mode',
        'transform-es2015-spread',
        'transform-es2015-parameters',
        'transform-es2015-destructuring',
        'transform-es2015-modules-commonjs'
      ]
    }))
    .pipe(gulp.dest('bin'))
})

gulp.task('buildTestNode', ['clear'], () => {
  return gulp.src('test/**/*.js')
    .pipe(babel({
      plugins: [
        'syntax-decorators',
        thisModule,
        'transform-strict-mode',
        'transform-es2015-spread',
        'transform-es2015-parameters',
        'transform-es2015-destructuring',
        'transform-es2015-modules-commonjs'
      ]
    }))
    .pipe(gulp.dest('bin_test/node'))
})

gulp.task('buildTestBrowser', ['clear'], () => {
  return gulp.src('test/**/*.js')
    .pipe(babel({
      plugins: [
        'syntax-decorators',
        thisModule,
        'transform-es2015-template-literals',
        'transform-es2015-literals',
        'transform-es2015-function-name',
        'transform-es2015-arrow-functions',
        'transform-es2015-block-scoped-functions',
        'transform-es2015-classes',
        'transform-es2015-object-super',
        'transform-es2015-shorthand-properties',
        'transform-es2015-computed-properties',
        'transform-es2015-for-of',
        'transform-es2015-sticky-regex',
        'transform-es2015-unicode-regex',
        'check-es2015-constants',
        'transform-es2015-spread',
        'transform-es2015-parameters',
        'transform-es2015-destructuring',
        'transform-es2015-block-scoping',
        'transform-es2015-typeof-symbol',
        'transform-es2015-modules-commonjs',
        'transform-regenerator'
      ]
    }))
    .pipe(gulp.dest('bin_test/browser'))
})

gulp.task('lint', () => {
  return gulp.src(['src/**/*.js', 'test/**/*.js'])
    .pipe(standard())
    .pipe(standard.reporter('default', {
      breakOnError: true,
      breakOnWarning: true
    }))
})

gulp.task('test', ['buildTestNode', 'buildTestBrowser'], () => {
  return gulp.src('bin_test/**/*.js', {read: false})
    .pipe(mocha())
})
