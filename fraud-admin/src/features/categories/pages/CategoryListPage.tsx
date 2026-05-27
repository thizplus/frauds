import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2, FolderOpen, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCategoryList, useCreateCategory, useUpdateCategory, useDeleteCategory, useReorderCategories } from '../hooks'
import { CategoryFormDialog } from '../components/CategoryFormDialog'
import type { CategoryItem } from '../types'
import { toast } from 'sonner'

export function CategoryListPage() {
  const { data: categories, isLoading } = useCategoryList()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  const reorderMutation = useReorderCategories()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<CategoryItem | null>(null)
  const [localOrder, setLocalOrder] = useState<CategoryItem[] | null>(null)

  const displayList = localOrder || categories || []

  const handleCreate = () => { setEditItem(null); setDialogOpen(true) }
  const handleEdit = (cat: CategoryItem) => { setEditItem(cat); setDialogOpen(true) }

  const handleDelete = (cat: CategoryItem) => {
    if (!confirm(`ต้องการลบหมวด "${cat.name}"?`)) return
    deleteMutation.mutate(cat.id, {
      onSuccess: () => toast.success(`ลบ "${cat.name}" แล้ว`),
      onError: () => toast.error('ลบไม่สำเร็จ'),
    })
  }

  const handleSubmit = (data: { id: string; name: string; description: string; icon: string }) => {
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: { name: data.name, description: data.description, icon: data.icon } },
        { onSuccess: () => { toast.success('แก้ไขสำเร็จ'); setDialogOpen(false) }, onError: () => toast.error('แก้ไขไม่สำเร็จ') }
      )
    } else {
      createMutation.mutate(data, {
        onSuccess: () => { toast.success('สร้างสำเร็จ'); setDialogOpen(false) }, onError: () => toast.error('สร้างไม่สำเร็จ')
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayList.findIndex((c) => c.id === active.id)
    const newIndex = displayList.findIndex((c) => c.id === over.id)
    const newOrder = arrayMove(displayList, oldIndex, newIndex)

    setLocalOrder(newOrder)
    reorderMutation.mutate(newOrder.map((c) => c.id), {
      onSuccess: () => { toast.success('บันทึกลำดับแล้ว'); setLocalOrder(null) },
      onError: () => { toast.error('บันทึกลำดับไม่สำเร็จ'); setLocalOrder(null) },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">หมวดหมู่</h1>
        <Button onClick={handleCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          เพิ่มหมวด
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : displayList.length > 0 ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayList.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y">
                  {displayList.map((cat) => (
                    <SortableRow
                      key={cat.id}
                      cat={cat}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      deleteDisabled={deleteMutation.isPending}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              ยังไม่มีหมวดหมู่
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
        editItem={editItem}
      />
    </div>
  )
}

function SortableRow({ cat, onEdit, onDelete, deleteDisabled }: {
  cat: CategoryItem
  onEdit: (cat: CategoryItem) => void
  onDelete: (cat: CategoryItem) => void
  deleteDisabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{cat.name}</span>
          {cat.icon && <Badge variant="outline" className="text-xs">{cat.icon}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {cat.id} {cat.description && `— ${cat.description}`}
        </div>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">{cat.fraudCount}</span>
      <div className="flex gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => onEdit(cat)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(cat)} disabled={deleteDisabled}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
