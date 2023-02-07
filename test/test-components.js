import { html, LitElement } from 'lit';

class TestComponent2 extends LitElement {
	render() {
		return html`<div></div>`;
	}
}

customElements.define('d2l-test-component-2', TestComponent2);

class TestComponent1 extends LitElement {
	render() {
		return html`<d2l-test-component-2></d2l-test-component-2>`;
	}
}

customElements.define('d2l-test-component-1', TestComponent1);
