// Vite resolves `import source from './x.glsl?raw'` to the file's text; this tells the editor the same.
declare module '*.glsl?raw' {
  const source: string;
  export default source;
}
// Vite resolves `import url from './env.hdr?url'` to the emitted asset's path. `.hdr` is not one of Vite's
// known asset types, so vite.config.ts also has to list it in assetsInclude for the build to emit it.
declare module '*.hdr?url' {
  const url: string;
  export default url;
}
