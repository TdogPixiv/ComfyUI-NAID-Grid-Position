class NAIDGridPosition:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0}),
                "y": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0}),
            }
        }

    RETURN_TYPES = ("FLOAT", "FLOAT")
    RETURN_NAMES = ("x", "y")
    FUNCTION = "run"
    CATEGORY = "NAID"

    def run(self, x, y):
        return (float(x), float(y))

NODE_CLASS_MAPPINGS = {
    "NAID Grid Position": NAIDGridPosition
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NAID Grid Position": "NAID Grid Position"
}