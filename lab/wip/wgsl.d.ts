// Vite resolves `import source from './x.wgsl?raw'` to the file's text; this tells the editor the same.
declare module '*.wgsl?raw' {
  const source: string;
  export default source;
}
