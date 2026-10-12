// Vite resolves `import saved from './params.json'`; this tells the editor the same thing.
declare module '*.json' {
  const value: unknown;
  export default value;
}
