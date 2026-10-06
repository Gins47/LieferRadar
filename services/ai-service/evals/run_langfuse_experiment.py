import asyncio

from langfuse import Evaluation, get_client

from evals.dataset import EVAL_CASES
from evals.evaluators import (
    COMMON_EVALUATORS,
    no_adversarial_delay_claim,
)
from reasoning.disruption import DisruptionReasoningService
from schemas.disruption import (
    DisruptionAssessment,
    DisruptionAssessmentRequest,
)


def get_reasoning_service() -> DisruptionReasoningService:
    return DisruptionReasoningService()


async def task(*, item, **kwargs):
    service = get_reasoning_service()

    request = DisruptionAssessmentRequest.model_validate(
        item["input"]
    )

    assessment = await service.assess(request)

    return assessment.model_dump(mode="json")


def deterministic_evaluator(
    *,
    input,
    output,
    metadata=None,
    **kwargs,
):
    request = DisruptionAssessmentRequest.model_validate(input)
    assessment = DisruptionAssessment.model_validate(output)

    results = [
        evaluator(request, assessment)
        for evaluator in COMMON_EVALUATORS
    ]

    if metadata and metadata.get("adversarialProviderText"):
        results.append(
            no_adversarial_delay_claim(
                request,
                assessment,
            )
        )

    return [
        Evaluation(
            name=result.name,
            value=1 if result.passed else 0,
            comment=result.message,
        )
        for result in results
    ]


async def main():
    langfuse = get_client()

    data = [
        {
            "input": case.request.model_dump(mode="json"),
            "metadata": {
                "case": case.name,
                "expectedUnknownDirection":
                    case.expected_unknown_direction,
                "expectedUnknownTiming":
                    case.expected_unknown_timing,
                "adversarialProviderText":
                    case.adversarial_provider_text,
            },
        }
        for case in EVAL_CASES
    ]

    result = langfuse.run_experiment(
        name="disruption-assessment-v1-scored",
        description=(
            "LieferRadar disruption reasoning regression suite"
        ),
        data=data,
        task=task,
        evaluators=[deterministic_evaluator],
        max_concurrency=1,
        metadata={
            "model": "gpt-4o-mini",
            "suite": "disruption-assessment-v1-scored",
        },
    )

    print(result.format())
    langfuse.flush()


if __name__ == "__main__":
    asyncio.run(main())