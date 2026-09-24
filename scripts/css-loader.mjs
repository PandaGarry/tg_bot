/** Node не умеет импортировать CSS — для тестов клиента подменяем его пустым модулем. */
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.css')) {
    return { url: 'data:text/javascript,export default {}', format: 'module', shortCircuit: true };
  }
  return next(specifier, context);
}
