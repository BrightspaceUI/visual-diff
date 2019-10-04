# visual-diff
[![Build status][ci-image]][ci-url]

A visual difference utility using Mocha, Chai, Puppeteer, and PixelMatch.

![screenshot of console log](/screenshots/sample-log.png?raw=true)

![screenshot of generated difference report](/screenshots/sample-report.png?raw=true)

## Installation

Install `visual-diff`.
```shell
npm i @brightspace-ui/visual-diff
npm i puppeteer
```

## Usage

**Note:** Both the `.html` and the `.js` file need to end with the `.visual-diff` suffix for the tests to run correctly.

### Create Test Fixture

Create an `.html` file containing the element to be tested. Below is an example `.html` file with the component to be tested.

***Tips:***
* provide some whitespace around the element so screenshots do not clip other fixtures on the page if larger clip dimensions are used for the screenshot.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>d2l-button-icon</title>
    <script src=".../node_modules/@webcomponents/webcomponentsjs/webcomponents-loader.js"></script>
    <script type="module">
      import '.../button-icon.js';
    </script>
  </head>
  <body>
    <d2l-button-icon id="normal" icon="d2l-tier1:gear" text="Icon Button"></d2l-button-icon>
  </body>
</html>
```

### Create Visual-Diff Tests

Create the visual-diff tests. Provide a ***unique*** name and the location where screenshots are saved. Use the `VisualDiff` context to navigate, take screenshots, and compare. Append the `--golden` arg to generate goldens. Below is an example of the visual-diff test for the above component.

***Tips:***
* use `deviceScaleFactor` to account for `dpr` (device-pixel-ratio), especially on retina display
* run diffs with a different view-port size for media queries; avoid duplicating
* bring page to front when testing focus (i.e. activate the browser tab)
* reset focus between tests if not reloading the page
* name screenshots using `this.test.fullTitle()`
* use the standard Puppeteer API for all its greatness
* wait for animations to complete before taking screenshot

```js
const puppeteer = require('puppeteer');
const VisualDiff = require('visual-diff');

describe('d2l-button-icon', function() {

  const visualDiff = new VisualDiff('button-icon', __dirname);

  let browser, page;

  before(async() => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
    await page.setViewport({width: 800, height: 800, deviceScaleFactor: 2});
    await page.goto(
      `${visualDiff.getBaseUrl()}/.../button-icon.visual-diff.html`,
      {waitUntil: ['networkidle0', 'load']}
    );
    await page.bringToFront();
  });

  after(() => browser.close());

  it('focus', async function() {
    await focus(page, '#normal');
    const rect = await visualDiff.getRect(page, '#normal');
    await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
  });

});
```

### Running Tests

First, generate goldens using `--golden` arg before making changes.

```json
"scripts": {
  "test:diff:golden": "mocha './test/**/*.visual-diff.js' -t 10000 --golden"
},
```

Make desired code changes, then run the tests to compare.

```json
"scripts": {
  "test:diff": "mocha './test/**/*.visual-diff.js' -t 10000"
},
```

***Tips:***
* specify a longer Mocha timeout (while a screenshot is worth a 1000 tests, each screenshot is slower compared to a typical  unit test)
* use Mocha's grep option to run a subset (i.e. `npm run test:diff -- -g some-pattern`)

### Running in CI

TODO

## Contributing

Contributions are welcome, please submit a pull request!

### Code Style

This repository is configured with [EditorConfig](http://editorconfig.org) rules and contributions should make use of them.

[ci-image]: https://travis-ci.com/Brightspace/visual-diff.svg?branch=master
[ci-url]: https://travis-ci.com/BrightspaceUI/visual-diff
