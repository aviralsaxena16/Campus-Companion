```mermaid
graph TD
    A[User] --> B(Frontend);
    B --> C{Backend};
    C --> D[Agent Core];
    D --> E((LLM));
    ...
```