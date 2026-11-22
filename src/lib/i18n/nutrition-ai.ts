import type { Messages } from "./types";

export const nutritionAiMessages: Messages = {
  "Распознавание по фото пока недоступно. Добавьте еду вручную или попробуйте позже.": {
    en: "Photo recognition is not available yet. Add food manually or try again later.",
    it: "Il riconoscimento delle foto non è ancora disponibile. Aggiungi il cibo manualmente o riprova più tardi.",
  },
  "Лимит распознавания исчерпан. Попробуйте позже или добавьте еду вручную.": {
    en: "The recognition quota has been reached. Try again later or add food manually.",
    it: "La quota di riconoscimento è stata raggiunta. Riprova più tardi o aggiungi il cibo manualmente.",
  },
  "Подсказка к фотографии: максимум 500 символов.": {
    en: "The photo hint can contain up to 500 characters.",
    it: "Il suggerimento per la foto può contenere fino a 500 caratteri.",
  },
};
