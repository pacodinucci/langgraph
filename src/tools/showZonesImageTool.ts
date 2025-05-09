import { tool } from "@langchain/core/tools";

export const showZonesImageTool = tool(
  async () => {
    return JSON.stringify({
      message:
        "Te muestro las zonas disponibles para que elijas cuáles querés tratar. Podés decirme varias si querés combinarlas en una misma sesión.",
      media:
        "https://res.cloudinary.com/ddtpavjz2/image/upload/v1746713910/ChatGPT_Image_May_8_2025_11_17_24_AM_nzaurk.png",
    });
  },
  {
    name: "show_zones_image",
    description:
      "Envía al paciente la imagen con todas las zonas disponibles para depilación.",
    schema: undefined, // no necesita parámetros
  }
);
