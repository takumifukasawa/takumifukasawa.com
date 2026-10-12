// Vite resolves `import source from './x.glsl?raw'` to the file's text; this tells the editor the same.
declare module '*.glsl?raw' {
  const source: string;
  export default source;
}
