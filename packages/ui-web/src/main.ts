import { GridCore } from "@gridcore/core";
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const core = new GridCore();

app.innerHTML = `
  <h1>GridCore Web UI</h1>
  <p>Engine version: ${core.getVersion()}</p>
  <div id="grid-container">
    <p>Grid will be rendered here...</p>
  </div>
`;