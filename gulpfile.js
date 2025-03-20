import { env, cwd } from 'node:process'
import { join, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { src, series, parallel, dest, watch, lastRun } from 'gulp'
import { deleteAsync } from 'del'
import gulpif from 'gulp-if'
import filesize from 'gulp-filesize'
import rename from 'gulp-rename'
import data from 'gulp-data'
import sharpResponsive from 'gulp-sharp-responsive'
import * as dartSass from 'sass'
import gulpSass from 'gulp-sass'
import postcss from 'gulp-postcss'
import stylelint from 'stylelint'
import csso from 'postcss-csso'
import reporter from 'postcss-reporter'
import debug from 'postcss-devtools'
import postcssScss from 'postcss-scss'
import autoprefixer from 'autoprefixer'
import gulpSvgSprite from 'gulp-svg-sprite'
import nunjucks from 'gulp-nunjucks-render'
import htmlLint from 'gulp-html-lint'
import chalk from 'chalk'
import table from 'text-table'
import bs from 'browser-sync'

const dev = 'src/';
const dist = 'public/';

const paths = {
  viewsDir: dev + 'templates/',
  distDir: dist,
  dev: {
    scss:  dev+'styles/**/*.{css,scss}',
    styles: dev+'styles/pages/*.{css,scss}',
    svg: dev+'images/sprite/*.svg',
    views: dev+'templates/**/*.njk',
    pages: dev+'templates/pages/*/*.{njk,html}',
    images: dev+'images/static/**/*.{jpg,jpeg,png,svg}',
  },
  dist: {
      pages: dist,
      styles: dist+'css',
      scripts: dist+'js',
      images: dist+'img',
      svg: dist+'img'
  }
};

const config = {
  devPort: 8080,
  uiPort: 7171
};
const sass = gulpSass(dartSass)

const { values:args } = parseArgs({
  options: {
    lint: {
      type: 'boolean',
      default: false
    },
    debug: {
      type: 'boolean',
      default: false
    },
    open: {
      type: 'boolean',
      default: false
    },
    min: {
      type: 'boolean',
      default: false
    },
  },
  strict: false,
  allowPositionals: true,
})

const isDev = env.NODE_ENV === 'development'

export const clean = () => deleteAsync([paths.distDir])

const getDataForFile = (file) => {
  const filePath = join(cwd(), paths.viewsDir, 'pages', dirname(file.relative), 'data.json');
  let fileContent

  try {
    fileContent = readFileSync(filePath, 'utf8')
  } catch (error) {
    fileContent = "{}"
    if (args.debug) console.warn(error.message)
  }

  return JSON.parse(fileContent)
};

function htmllintReporter(results) {
  function pluralize(word, count) {
    return (count === 1 ? word : `${word}s`);
  }
  let output = '\n',
    total = 0,
    errors = 0,
    warnings = 0,
    summaryColor = 'yellow';

  results.forEach((result) => {
    const issues = result.issues;

    if (issues.length === 0) {
      return;
    }

    total += issues.length;
    output += chalk.underline(result.relativeFilePath) + '\n';
    output += table(
      issues.map((issue) => {
        let messageType;
        if (issue.error) {
          messageType = chalk.red('error');
          summaryColor = 'red';
          errors++;
        } else {
          messageType = chalk.yellow('warning');
          warnings++;
        }

        return [
          '',
          issue.line || 0,
          issue.column || 0,
          messageType,
          issue.message.replace(/\.$/, ''),
          chalk.dim(issue.rule || '')
        ];
      }),
      {
        align: ['', 'r', 'l'],
      }
    ).split('\n').map((el) => {
      return el.replace(/(\d+)\s+(\d+)/, (m, p1, p2) => {
        return chalk.dim(`${p1}:${p2}`);
      });
    }).join('\n') + '\n\n';
  });

  if (total > 0) {
    output += chalk[summaryColor].bold([
      '\u2716 ', total, pluralize(' problem', total),
      ' (', errors, pluralize(' error', errors), ', ',
      warnings, pluralize(' warning', warnings), ')\n'
    ].join(''));
  }

  return total > 0 ? output : '';
}

export const styles = () =>
  src(paths.dev.styles, { sourcemaps: true, since: lastRun(styles) })
    .pipe(sass({
      outputStyle: 'expanded',
      indentWidth: 4
    }).on('error', sass.logError))
    .pipe(postcss([
      args.lint ? stylelint() : () => {},
      isDev ? debug : () => { },
      autoprefixer({
        cascade: false
      }),
      args.min ? csso : () => { },
      reporter({
        clearReportedMessages: true,
        clearMessages: true
      })
    ], { syntax: postcssScss }))
    .pipe(dest(paths.dist.styles, { sourcemaps: true }))
    .pipe(gulpif(args.debug, filesize()))
    .pipe(bs.stream())

export const images = () =>
  src(paths.dev.images, { since: lastRun(images), encoding: false })
    .pipe(sharpResponsive({
      formats: [
        { format: 'webp', rename: { suffix: "-2x" } },
        { format: 'avif', rename: { suffix: "-2x" } },
        { width: (metadata) => metadata.width * 0.5, format: 'webp', rename: { suffix: "-1x" } },
        { width: (metadata) => metadata.width * 0.5, format: 'avif', rename: { suffix: "-1x" } },
      ]
    }))
    .pipe(dest(paths.dist.images))
    .pipe(bs.stream())

export const sprite = () =>
  src(paths.dev.svg)
    .pipe(gulpSvgSprite({
      mode: {
        symbol: {
          dest: '.',
          sprite: join(paths.dist.svg, 'sprite.svg'),
          dimensions: false,
          bust: false
        }
      }
    }))
    .pipe(dest('.'))
    .pipe(bs.stream())

export const markup = () =>
  src(paths.dev.pages, { since: lastRun(markup) })
    .pipe(data(getDataForFile))
    .pipe(nunjucks({
      path: paths.viewsDir
    }))
    .pipe(htmlLint({
      htmllintrc: ".htmllintrc.json",
      useHtmllintrc: true,
    }))
    .pipe(htmlLint.format(htmllintReporter))
    .pipe(rename({ dirname: '' }))
    .pipe(dest(paths.dist.pages))
    .pipe(gulpif(args.debug, filesize()))
    .pipe(bs.stream())

export const liveReload = () =>
  bs.init({
    port: config.devPort,
    ui: args.debug ? {
      port: config.uiPort
    } : false,
    ghostMode: false,
    logPrefix: 'binabox',
    logLevel: args.debug ? 'debug' : 'info',
    logConnections: args.debug,
    logSnippet: false,
    reloadOnRestart: true,
    notify: false,
    open: args.open ? 'external' : false,
    baseDir: paths.distDir,
    server: ['.', paths.distDir]
  })

export const build = series(clean, parallel(styles, images, sprite, markup))

const watchFiles = (cb) => {
  watch(paths.dev.scss, { delay: 1000 }, styles)
  watch(paths.dev.images, { delay: 1000 }, images)
  watch(paths.dev.svg, { delay: 1000 }, sprite)
  watch(paths.dev.views, { delay: 1000 }, markup)
  cb()
}
export { watchFiles as watch }

export const serve = series(
  build,
  watchFiles,
  liveReload,
)

export default build