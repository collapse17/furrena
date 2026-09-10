/** A typed, runtime identifier for data stored on an entity. */
export interface ComponentType<T> {
  readonly id: symbol;
  readonly name: string;
  readonly __component?: T;
}

export function defineComponent<T>(name: string): ComponentType<T> {
  return { id: Symbol(name), name };
}
