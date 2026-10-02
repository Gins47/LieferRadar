
def chunk_text( 
        text:str,
        chunk_size:int=500,
        overlap:int=50
        ) -> list[str]:
    if len(text) == 0:
        return []
    elif chunk_size < 0:
        raise ValueError("chunk_size should not be less than 0 ")
    elif overlap >= chunk_size:
        raise ValueError("overlap value cannot be greater than the chunk_size ")
    elif overlap < 0:
        raise ValueError("overlap should not be less than 0 ")

    result:list[str] = []

    start = 0
    end = 0

    while start < len(text):
        end = start + chunk_size
        print(f"start = {start}, end = {end}")
        result.append(text[start:end])
        start = end - overlap

    return result

