/// <reference types="vite/client" />

// CSS Modules (актуально как для клиента, так и для компонентов темы Mitchell,
// чьи .tsx подтягиваются через workspace:* и импортируют *.module.css).
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
