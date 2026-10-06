from langfuse import get_client


langfuse = get_client()

with langfuse.start_as_current_observation(
    as_type="span",
    name="liefer-radar-test",
) as span:
    span.update(
        input={
            "source": "LieferRadar",
            "message": "Testing Langfuse integration",
        },
        output={
            "status": "ok",
        },
    )

langfuse.flush()

print("Trace sent")