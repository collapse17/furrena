export interface ResourceType<T> {
  readonly id: symbol;
  readonly name: string;
  readonly __resource?: T;
}

export function defineResource<T>(name: string): ResourceType<T> {
  return { id: Symbol(name), name };
}
