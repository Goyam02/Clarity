## 3. Evaluator Agent

```mermaid
graph TB
    classDef component fill:#1f1f1f,stroke:#8a8a8a,stroke-width:1px,color:#f2f2f2;
    classDef llm fill:#1f1f1f,stroke:#8a8a8a,stroke-width:1px,color:#ffffff;
    classDef datastore fill:#1f1f1f,stroke:#8a8a8a,stroke-width:1px,color:#f2f2f2;
    classDef deterministic fill:#1f1f1f,stroke:#8a8a8a,stroke-width:1px,color:#f2f2f2;
    classDef io fill:#1f1f1f,stroke:#8a8a8a,stroke-width:1px,color:#f2f2f2;

    IN(["Submitted Code<br/>+ Explanation"]):::io --> EXE

    subgraph EXE["Sandboxed Execution"]
        E1["Run Against Test Cases"]:::component
        E2["Collect Pass/Fail, Runtime, Errors"]:::component
        E1 --> E2
    end

    EXE -->|"execution result"| LLM{{"Evaluator LLM <br/> GPT-5.4-mini"}}:::llm
    LLM -->|"qualitative assessment:<br/>correctness, hint use,<br/>explanation quality"| ME["Mastery Engine<br/>(deterministic score update)"]:::deterministic
    ME --> MM[("Mastery Model<br/>updated + logged")]:::datastore
    MM --> OUT(["Score + Feedback<br/>+ Mastery Delta"]):::io

---