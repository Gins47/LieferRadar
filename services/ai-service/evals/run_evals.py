import asyncio

from evals.dataset import EVAL_CASES
from evals.evaluators import (
    COMMON_EVALUATORS,
    no_adversarial_delay_claim,
)
from reasoning.disruption import DisruptionReasoningService


def get_reasoning_service() -> DisruptionReasoningService:
    return DisruptionReasoningService()


async def run() -> None:
    service = get_reasoning_service()

    passed = 0
    total = 0

    print("\nLieferRadar AI Evals")
    print("=" * 40)

    for case in EVAL_CASES:
        print(f"\n{case.name}")
        print("-" * len(case.name))

        try:
            assessment = await service.assess(case.request)

            print(f"  operatorMessage: {assessment.operatorMessage}")

            for evidence in assessment.supportingEvidence:
                print(f"  evidence: {evidence.explanation}")

            for uncertainty in assessment.uncertainty:
                print(f"  uncertainty: {uncertainty}")

            for consequence in assessment.possibleConsequences:
                print(f"  consequence: {consequence}")

        except Exception as error:
            total += 1
            print("  ✗ execution")
            print(f"    {error}")
            continue

        # Run common evaluators for every case.
        for evaluator in COMMON_EVALUATORS:
            result = evaluator(
                case.request,
                assessment,
            )

            total += 1

            if result.passed:
                passed += 1
                print(f"  ✓ {result.name}")
            else:
                print(f"  ✗ {result.name}")

                if result.message:
                    print(f"    {result.message}")

        # Run adversarial-specific evaluator only for that case.
        if case.adversarial_provider_text:
            result = no_adversarial_delay_claim(
                case.request,
                assessment,
            )

            total += 1

            if result.passed:
                passed += 1
                print(f"  ✓ {result.name}")
            else:
                print(f"  ✗ {result.name}")

                if result.message:
                    print(f"    {result.message}")

    print("\n" + "=" * 40)
    print(f"{passed}/{total} checks passed")

    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(run())