# Editing Decision Rules

This file configures when and how the AI agents should automatically update the world economy ideas repository (info.md).

## Trigger Criteria

The Editing Decision Agent will recommend updating the summary when conversations contain:

- **Novel economic ideas** that don't currently exist anywhere in the world
- **Innovative combinations** of existing economic concepts applied in unique practical ways
- **Breakthrough insights** for global economic challenges
- **Scalable solutions** that could impact world economy
- **Disruptive economic models** with practical implementation potential

## Content Filtering Rules - Strict Idea Evaluation

### INCLUDE in Summary (ONLY if meeting these strict criteria)

**Rule A: Completely Novel Ideas**
- Ideas that demonstrably don't exist anywhere in the world currently
- AI websearch verification REQUIRED to confirm novelty
- Must be practical and implementable, not purely theoretical
- Should address real economic problems or opportunities

**Rule B: Unique Practical Combinations**
- Combinations of existing economic concepts/systems in novel ways
- Must be practically applicable, not just conceptual
- Should create new value or solve problems existing systems cannot
- Combination must be genuinely unique in its practical application

### EXCLUDE from Summary
- Ideas that already exist in similar forms anywhere globally
- Purely theoretical concepts without practical implementation paths
- Minor variations of existing economic systems
- Ideas that fail websearch novelty verification
- Vague or incomplete economic concepts
- Ideas without clear practical application or scalability potential

## Update Frequency Controls

- **Minimum conversation depth**: 5-10 meaningful message exchanges before considering update
- **Cooldown period**: Maximum 1 update per 30-minute window to allow thorough evaluation
- **Substantiveness threshold**: Very high (only breakthrough economic ideas qualify)
- **Quality filter**: Must pass both Rule A or Rule B criteria with websearch verification

## Decision Reasoning & Verification Process

The Editing Decision Agent must provide detailed reasoning including:
- **Novelty verification**: Results of websearch confirming idea doesn't exist globally
- **Practical assessment**: Clear explanation of implementation feasibility
- **Economic impact evaluation**: Potential for meaningful world economy influence
- **Rule compliance**: Explicit confirmation of Rule A or Rule B criteria being met
- **Websearch methodology**: Search terms and sources checked for novelty verification

## Summary Integration Guidelines

When updating info.md, the Content Integration Agent should:
- Add ideas to appropriate sections based on economic domain (Finance, Trade, Technology, etc.)
- Include novelty verification summary and practical implementation pathway
- Maintain academic whitepaper tone and structure
- Provide clear attribution when participants share identifying information
- Cross-reference with existing ideas to prevent duplication
- Update the research bibliography and last updated timestamp

---

*These rules can be modified to adjust the automated summary system behavior.*