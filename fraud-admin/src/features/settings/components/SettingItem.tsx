import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Loader2 } from 'lucide-react'
import type { Setting } from '../types'
import { useUpdateSetting } from '../hooks'
import { toast } from 'sonner'

interface SettingItemProps {
  setting: Setting
  type?: 'text' | 'number' | 'boolean' | 'select'
  options?: { label: string; value: string }[]
  suffix?: string
  label?: string
  hint?: string
}

export function SettingItem({ setting, type = 'text', options, suffix, label: labelProp, hint }: SettingItemProps) {
  const [value, setValue] = useState<unknown>(setting.value)
  const [changed, setChanged] = useState(false)
  const update = useUpdateSetting()

  const handleChange = (newValue: unknown) => {
    setValue(newValue)
    setChanged(JSON.stringify(newValue) !== JSON.stringify(setting.value))
  }

  const handleSave = () => {
    update.mutate(
      { key: setting.key, data: { value } },
      {
        onSuccess: () => {
          setChanged(false)
          toast.success(`บันทึกสำเร็จ`)
        },
        onError: () => toast.error('บันทึกไม่สำเร็จ'),
      }
    )
  }

  const displayLabel = labelProp || setting.description || setting.key.split('.').pop() || setting.key

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{displayLabel}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {type === 'boolean' ? (
          <Switch
            checked={!!value}
            onCheckedChange={(checked) => handleChange(checked)}
          />
        ) : type === 'select' && options ? (
          <Select
            value={String(value)}
            onValueChange={(val) => handleChange(val)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input
              type={type === 'number' ? 'number' : 'text'}
              className="w-24 h-9"
              value={String(value ?? '')}
              onChange={(e) =>
                handleChange(type === 'number' ? Number(e.target.value) : e.target.value)
              }
            />
            {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
          </div>
        )}

        {changed && (
          <Button size="sm" onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}
