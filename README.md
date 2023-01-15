# visual-diff
[![NPM version](https://img.shields.io/npm/v/@brightspace-ui/visual-diff.svg)](https://www.npmjs.org/package/@brightspace-ui/visual-diff)
[![NPM downloads](https://img.shields.io/npm/dt/@brightspace-ui/visual-diff.svg)](https://www.npmjs.com/package/@brightspace-ui/visual-diff)

A visual difference utility using Mocha, Chai, Puppeteer, and PixelMatch.

![screenshot of console log](/screenshots/sample-log.png?raw=true)

![screenshot of generated difference report](/screenshots/sample-report.png?raw=true)

## Installation

This package is designed to be used alongside the [visual-diff GitHub action](https://github.com/BrightspaceUI/actions/tree/main/visual-diff).  That action will handle installing so you don't need to include `visual-diff` and `puppeteer` in your repo's `devDependencies`.

To run the tests locally to help troubleshoot or develop new tests, first install these dependencies:

```shell
npm install @brightspace-ui/visual-diff@X  --no-save
```

Replace `X` with [the current version](https://github.com/BrightspaceUI/actions/tree/main/visual-diff#current-dependency-versions) the action is using.

## Writing Tests

**Note:** Both the `.html` and the `.js` file need to end with the `.visual-diff` suffix for the tests to run correctly.

### Create Visual-Diff Tests

#### Standard Setup

Create a `<my-element>.visual-diff.html` file containing the element to be tested.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta charset="UTF-8">
  <title>d2l-button-icon</title>
  <script type="module">
    import '@brightspace-ui/core/components/typography/typography.js';
    import '.../button-icon.js';
  </script>
  <style>
    html { font-size: 20px; }
    body { padding: 30px; }
    .visual-diff { margin-bottom: 30px; }
  </style>
</head>
<body class="d2l-typography">

  <div class="visual-diff">
    <d2l-button-icon id="simple" icon="d2l-tier1:gear" text="Icon Button"></d2l-button-icon>
  </div>

</body>
</html>
```

Create a `<my-element>.visual-diff.js` file containing the tests, using a ***unique*** name for the set.

```js
import puppeteer from 'puppeteer';
import { VisualDiff } from '@brightspace-ui/visual-diff';

describe('d2l-button-icon', function() {

  const visualDiff = new VisualDiff('button-icon', import.meta.url);

  let browser, page;

  before(async() => {
    browser = await puppeteer.launch();
    page = await visualDiff.createPage(browser);
    await page.goto(
      `${visualDiff.getBaseUrl()}/path/to/component/button-icon.visual-diff.html`,
      {waitUntil: ['networkidle0', 'load']}
    );
    await page.bringToFront();
  });

  beforeEach(async() => await visualDiff.resetFocus(page));

  after(async() => await browser.close());

  it('normal', async function() {
    const rect = await visualDiff.getRect(page, '#simple');
    await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
  });

  it('focus', async function() {
    await visualDiff.focus(page, '#simple');
    const rect = await visualDiff.getRect(page, '#simple');
    await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
  });

});
```

***Tips:***
* include `typography.js` to load our fonts, etc.
* provide some whitespace around the fixture so screenshots do not include other fixtures on the page when larger clip dimensions are used
* use the `createPage(browser)` helper to create a page with the reduced motion preference, default view-port dimensions (800x800), and device scaling factor (device pixel ratio).
* bring page to front when testing focus (i.e. activate the browser tab)
* only make screenshots as big as they need to be since larger screenshots are slower to compare
* reset focus between tests if not reloading the page
* name screenshots using `this.test.fullTitle()`
* use the [standard Puppeteer API](https://pptr.dev/) for all its greatness

#### Asynchronous Behaviors

Components may also have asynchronous behaviors (loading data, animations, etc.) triggered by user-interaction which require the tests to wait before taking screenshots. This is typically handled by waiting for an event using one of a couple approaches. The first uses our `oneEvent` helper:

```js
import { oneEvent } from '@brightspace-ui/visual-diff';

it('some-test', async function() {

  const someEvent = oneEvent(page, '#simple', 'd2l-some-event');
  page.$eval('#simple', elem => elem.someAsyncAction());
  await someEvent;

  const rect = await visualDiff.getRect(page, '#simple');
  await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });

});
```

The second approach wires up an event handler directly to the element dispatching the event, however this is less desirable since it requires the test having knowledge of the component's internal DOM structure.

```js
it('some-test', async function() {

  await page.$eval('#simple', elem => {
    return new Promise(resolve => {

      elem.shadowRoot.querySelector('...')
        .addEventListener('d2l-some-event', resolve, { once: true } );

      elem.someAsyncAction();

    })
  });

  const rect = await visualDiff.getRect(page, '#simple');
  await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });

});
```

***Tips:***
* use the `oneEvent` visual-diff helper to wait for events
* not all events bubble, and not all events are composed, so in some cases it's necessary to wire-up directly to the element dispatching the event
* animation and transition event handlers may be called more than once if multiple properties are being animated. For animations, it is best if the component supports `prefers-reduced-motion: reduce`. See Animations below.

#### Responsive

Use Puppeteer's `setViewport` API to perform visual-diff tests with different view dimensions.

```js
[
  { category: 'wide', viewport: { width: 800, height: 500 } },
  { category: 'narrow', viewport: { width: 600, height: 500 } }
].forEach(info => {

  describe(info.category, () => {

    before(async() => {
      await page.setViewport({
        height: info.viewport.height, width: info.viewport.width,
        deviceScaleFactor: 2
      });
    });

    it('some-test', async function() {
      ...
    });

  });

});
```

***Tips:***
* run diffs with a different view-port size for components containing media queries
* avoid duplicating tests unnecessarily (i.e. don't need to duplicate every test at every breakpoint)
* always use `deviceScaleFactor: 2`

#### Right-to-Left (RTL)

There are two approaches for setting up visual-diff tests in RTL. The first approach leverages the fact that our [RtlMixin](https://github.com/BrightspaceUI/core/blob/main/mixins/rtl-mixin.md) will honor `dir="rtl"` on elements. It works for simple components that aren't composed of other components that are also sensitive to the text direction. It has the advantage of not requiring a page reload between sets of tests.

```html
<div class="visual-diff">
  <d2l-button-icon dir="rtl" ...></d2l-button-icon>
</div>
```

The second approach involves navigating the page using Puppeteer's `goto` API, passing a query-string parameter that is used to apply `dir="rtl"` to the document. It requires more setup, but is useful in scenarios where fixtures contain many elements or have elements that are composed of other components that would require `dir="rtl"`. This approach best matches how our pages are rendered.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  ...
  <script>
    const rtl = (window.location.search.indexOf('dir=rtl') !== -1);
    if (rtl) document.documentElement.setAttribute('dir', 'rtl');
  </script>
  ...
</head>
<body class="d2l-typography">
  ...
</body>
</html>
```

```js
['ltr', 'rtl'].forEach(dir => {

  describe(dir, () => {

    before(async() => {
      await page.goto(
        `${visualDiff.getBaseUrl()}/path/to/component/button-icon.visual-diff.html?dir=${dir}`,
        {waitUntil: ['networkidle0', 'load']}
      );
      await page.bringToFront();
    });

    it('some-test', async function() {
      ...
    });

  });

});
```

***Tips:***
* avoid duplicating tests unnecessarily (i.e. don't need to perform every test in both LTR and RTL)

#### Animations

Animations (CSS key-frame animations or transitions) in components can lead to flakey inconsistent screenshots. To avoid inconsistent results, it is best to use the `createPage` visual-diff helper that emulates the `prefers-reduced-motion` user preference. However, this approach depends on components honoring the preference with media-queries (which all of our `core` components do with the exception of `d2l-loading-spinner`).

```css
@media (prefers-reduced-motion: reduce) {
  :host {
    animation: none; /* or... */
    transition: none;
  }
}
```

Alternatively, visual-diff tests can wait for `transitionend` and `animationend` events.  However, this is not recommended becuase:
* these events are not composed and requires tests having knowledge of component internals
* these events may be dispatched more than once when multiple properties are animated
* waiting for animations makes the tests run slower

#### API

```js
// creates a browser page with reduced motion;
// optional options to override default 800x800px dimensions (ex. { viewport: { width: 700, height: 400 } })
await visualDiff.createPage(browser, options);

// selects an element in the document's light-DOM and focuses it
await visualDiff.focus(page, selector);

// gets the base URL of the server (ex. http://localhost:8000)
visualDiff.getBaseUrl();

// selects an element in the document's light-DOM and gets a rect object for use with screenshotAndCompare (ex. { x: 50, y: 50, width: 200, height: 100 });
// optional margin default is 10px
await visualDiff.getRect(page, selector, margin);

// selects an element in the document's light-DOM and awaits the specified event
await visualDiff.oneEvent(page, selector, name);

// removes focus from current active element
await visualDiff.resetFocus(page);

// takes screenshot using specified clip rect (ex. { clip: rect }) to generate or compare to golden;
// optional compareOptions (ex. { allowedPixels: 24 })
await visualDiff.screenshotAndCompare(page, name, screenshotOptions, compareOptions);
```

## Running Tests

### In CI

This package is designed to be used alongside the [visual-diff github action](https://github.com/BrightspaceUI/actions/tree/main/visual-diff).  Check out the README there for setup details.

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
* use Mocha's grep option to run a subset locally (i.e. `mocha './test/**/*.visual-diff.js' -t 10000 -- -g some-pattern`)

***Troubleshooting:***
* The visual-diff tests require using a **non-Admin** terminal to run the tests - otherwise, Chromium does not navigate to the `html` test page
* To see what a test is doing to help you debug issues, you can replace the `browser = await puppeteer.launch();` line in the `js` file with `browser = await puppeteer.launch({ headless: false });` locally

## Versioning & Releasing

> TL;DR: Commits prefixed with `fix:` and `feat:` will trigger patch and minor releases when merged to `main`. Read on for more details...

The [sematic-release GitHub Action](https://github.com/BrightspaceUI/actions/tree/main/semantic-release) is called from the `release.yml` GitHub Action workflow to handle version changes and releasing.

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
