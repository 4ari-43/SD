
from FlagEmbedding import BGEM3FlagModel
from config import MODEL_NAME


# ==========================================
# LOAD BGE-M3 MODEL
# ==========================================

print("Loading BGE-M3 model...")

model = BGEM3FlagModel(
    MODEL_NAME,
    use_fp16=False
)

print("BGE-M3 loaded successfully!")
