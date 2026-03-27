# Prompt Engineering & Agent Communication Guide

## Core Techniques

**Few-Shot Learning**: Demonstrate desired behavior through 2-5 examples rather than explicit rules, balancing accuracy gains against token consumption.

**Chain-of-Thought**: Request step-by-step reasoning to improve accuracy on complex problems by 30-50%, particularly for analytical tasks.

**System Prompts**: Set persistent global behavior, role definition, and output constraints that remain stable across conversations.

## Key Principles for Agent Prompting

### Context Efficiency
The context window is shared across all instructions and conversation history. Claude already possesses substantial knowledge, so avoid redundant explanations. Challenge each statement: does it justify its token cost?

### Degrees of Freedom

Match specificity to task fragility:
- **High freedom** (text guidance): Multiple valid approaches exist
- **Medium freedom** (pseudocode): A preferred pattern with acceptable variation
- **Low freedom** (exact scripts): Operations requiring consistency and precision

### Persuasion Principles

Research shows persuasion techniques doubled compliance rates in agent interactions. Seven effective principles include:

**Authority**: "YOU MUST" eliminates rationalization for safety-critical practices.

**Commitment**: Require explicit announcements and choices to ensure accountability.

**Scarcity**: Create urgency through time-bound requirements to prevent procrastination.

**Social Proof**: "Every time" and failure-mode warnings establish universal norms.

**Unity**: Use collaborative language like "we're colleagues" for non-hierarchical work.

Avoid "Liking" for compliance—it creates sycophancy rather than honest feedback.

## Best Practices

- Test prompts on diverse inputs, including edge cases
- Treat prompts as versioned code
- Start simple, then add complexity progressively
- Monitor production performance metrics
- Document the reasoning behind structural choices
