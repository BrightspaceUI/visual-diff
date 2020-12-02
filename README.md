# visual-diff
[![NPM version](https://img.shields.io/npm/v/@brightspace-ui/visual-diff.svg)](https://www.npmjs.org/package/@brightspace-ui/visual-diff)
[![NPM downloads](https://img.shields.io/npm/dt/@brightspace-ui/visual-diff.svg)](https://www.npmjs.com/package/@brightspace-ui/visual-diff)

A visual difference utility using Mocha, Chai, Puppeteer, and PixelMatch.

![screenshot of console log](/screenshots/sample-log.png?raw=true)

![screenshot of generated difference report](/screenshots/sample-report.png?raw=true)

## Installation

This package is designed to be used alongside the [visual-diff github action](https://github.com/BrightspaceUI/actions/tree/master/visual-diff).  That action will handle installing so you don't need to include `visual-diff` and `puppeteer` in your repo's `devDependencies`.

If you want to install locally for test creation and troubleshooting, run:
```shell
npm i mocha -g
npm i @brightspace-ui/visual-diff puppeteer --no-save
```

## Writing Tests

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

Create the visual-diff tests. Provide a ***unique*** name and the location where screenshots are saved. Use the `VisualDiff` context to navigate, take screenshots, and compare.  Below is an example of the visual-diff test for the above component.

***Tips:***
* use the `createPage(browser)` helper to create a page with the reduced motion preference, default viewport dimensions (800x800), and device scaling factor.
* use `deviceScaleFactor` to account for `dpr` (device-pixel-ratio), especially on retina display
* run diffs with a different view-port size for media queries; avoid duplicating
* bring page to front when testing focus (i.e. activate the browser tab)
* reset focus between tests if not reloading the page
* name screenshots using `this.test.fullTitle()`
* use the standard Puppeteer API for all its greatness
* use the `prefers-reduced-motion: reduce` media query in your component, or wait for animations to complete before taking screenshots


```js
const puppeteer = require('puppeteer');
const VisualDiff = require('visual-diff');

describe('d2l-button-icon', function() {

  const visualDiff = new VisualDiff('button-icon', __dirname);

  let browser, page;

  before(async() => {
    browser = await puppeteer.launch();
    page = await visualDiff.createPage(browser);
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

## Running Tests

### In CI

This package is designed to be used alongside the [visual-diff github action](https://github.com/BrightspaceUI/actions/tree/master/visual-diff).  Check out the README there for setup details.

The action will handle installation and running the tests, as well as automatically opening a PR for any golden updates that are needed.

### Locally

First, generate goldens using the `--golden` arg before making changes.
```shell
mocha './test/**/*.visual-diff.js' -t 10000 --golden
```

Make desired code changes, then run the tests to compare.
```shell
mocha './test/**/*.visual-diff.js' -t 10000
```

Because of the difference in local and CI environments, you can't commit the goldens you create locally.  This workflow is only to help troubleshoot and write new tests.  You will probably want to add the following to your `.gitignore` file:
```
<path_to_test>/test/screenshots/current/
<path_to_test>/test/screenshots/golden/
```

***Tips:***
* specify a longer Mocha timeout (while a screenshot is worth a 1000 tests, each screenshot is slower compared to a typical  unit test)
* use Mocha's grep option to run a subset locally (i.e. `npm run test:diff -- -g some-pattern`)

## Versioning & Releasing

> TL;DR: Commits prefixed with `fix:` and `feat:` will trigger patch and minor releases when merged to `master`. Read on for more details...

The [sematic-release GitHub Action](https://github.com/BrightspaceUI/actions/tree/master/semantic-release) is called from the `release.yml` GitHub Action workflow to handle version changes and releasing.

### Version Changes

All version changes should obey [semantic versioning](https://semver.org/) rules:
1. **MAJOR** version when you make incompatible API changes,
2. **MINOR** version when you add functionality in a backwards compatible manner, and
3. **PATCH** version when you make backwards compatible bug fixes.

The next version number will be determined from the commit messages since the previous release. Our semantic-release configuration uses the [Angular convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular) when analyzing commits:
* Commits which are prefixed with `fix:` or `perf:` will trigger a `patch` release. Example: `fix: validate input before using`
* Commits which are prefixed with `feat:` will trigger a `minor` release. Example: `feat: add toggle() method`
* To trigger a MAJOR release, include `BREAKING CHANGE:` with a space or two newlines in the footer of the commit message
* Other suggested prefixes which will **NOT** trigger a release: `build:`, `ci:`, `docs:`, `style:`, `refactor:` and `test:`. Example: `docs: adding README for new component`

To revert a change, add the `revert:` prefix to the original commit message. This will cause the reverted change to be omitted from the release notes. Example: `revert: fix: validate input before using`.

### Releases

When a release is triggered, it will:
* Update the version in `package.json`
* Tag the commit
* Create a GitHub release (including release notes)
* Deploy a new package to NPM

### Releasing from Maintenance Branches

Occasionally you'll want to backport a feature or bug fix to an older release. `semantic-release` refers to these as [maintenance branches](https://semantic-release.gitbook.io/semantic-release/usage/workflow-configuration#maintenance-branches).

Maintenance branch names should be of the form: `+([0-9])?(.{+([0-9]),x}).x`.

Regular expressions are complicated, but this essentially means branch names should look like:
* `1.15.x` for patch releases on top of the `1.15` release (after version `1.16` exists)
* `2.x` for feature releases on top of the `2` release (after version `3` exists)

## Contributing

Contributions are welcome, please submit a pull request!

### Code Style

This repository is configured with [EditorConfig](http://editorconfig.org) rules and contributions should make use of them.
