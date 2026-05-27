import { useMutation } from '@tanstack/react-query'
import { reportService, type CreateReportData } from './service'

export function useCreateReport() {
  return useMutation({
    mutationFn: (data: CreateReportData) => reportService.create(data),
  })
}
