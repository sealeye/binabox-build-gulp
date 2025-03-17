# Binabox

## First install
Run `npm ci` after first installation to install dependencies

## Commands

Run these commands to get something in your public folder

* `npm start` will generate site
* `npm run dev` will generate site, show lint errors, watch files and re-run build on change

Separate commands per task:
* `npx gulp clean` will clean up your public folder
* `npx gulp styles` will process your scss styles with entry points at `src/styles/pages` into css files at * `public/css`
* `npx gulp markup` will process your nunjucks templates into html in public folder
* `npx gulp images` will optimize images
* `npx gulp sprite` will combine svg files from `src/images/sprite` folder into `public/sprite.svg`

## Credits

Student:

Mentor:

