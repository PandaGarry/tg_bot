// Глобальная декларация CSS Modules для всего пакета темы.
// Файл необходим, чтобы TypeScript (в том числе typecheck клиентского
// приложения, которое подтягивает .tsx темы напрямую) не ругался на
// импорт './Foo.module.css' внутри пакета.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
