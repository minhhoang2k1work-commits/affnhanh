export function resolveSelectedFlowTemplateId(search: string, selectedTemplateId?: string | null) {
  return selectedTemplateId || new URLSearchParams(search).get('templateId');
}
