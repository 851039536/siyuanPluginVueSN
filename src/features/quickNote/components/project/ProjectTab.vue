<template>
  <section class="panel-section">
    <!-- 项目新增/编辑表单 -->
    <ProjectForm
      :i18n="i18n"
      :editing-project="editingProject"
      @submit="handleProjectSubmit"
      @cancel="handleCancelEdit"
    />
    <div class="project-list">
      <!-- 空态提示 -->
      <div
        v-if="visibleProjects.length === 0"
        class="project-list__empty"
      >{{ i18n.projectEmpty }}</div>
      <ProjectItem
        v-for="project in visibleProjects"
        :key="project.id"
        :project="project"
        :linked-todos="linkedTodosOf(project.id)"
        :progress="projectProgressOf(project.id)"
        :i18n="i18n"
        @edit="startEdit(project)"
        @remove="handleProjectRemove(project.id)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 项目 Tab
 * 项目新增/编辑表单 + 项目卡片列表；持有编辑中项目状态，
 * CRUD 与关联待办/进度计算直达 projectsApi composable
 */
import type { ProjectItem as ProjectItemType, ProjectSubmitPayload } from "../../types"
import { ref } from "vue"
import ProjectForm from "./ProjectForm.vue"
import ProjectItem from "./ProjectItem.vue"
import { useProjects } from "../../composables/useProjects"

type ProjectsApi = ReturnType<typeof useProjects>

const props = defineProps<{
  i18n: Record<string, string>
  projectsApi: ProjectsApi
}>()

const projectsApi = props.projectsApi

/** 可见项目列表（未完成在前、已完成排后） */
const visibleProjects = projectsApi.visibleProjects

/** 编辑中的项目（null 为新增模式） */
const editingProject = ref<ProjectItemType | null>(null)

/** 某项目关联的待办列表 */
const linkedTodosOf = (id: string) => projectsApi.todosOf(id)

/** 某项目关联待办的完成进度 */
const projectProgressOf = (id: string) => projectsApi.progressOf(id)

/** 删除项目（带确认） */
const handleProjectRemove = (id: string) => {
  if (!window.confirm(props.i18n.deleteConfirm)) return
  projectsApi.remove(id)
}

/** 开始编辑项目（回填表单） */
const startEdit = (project: ProjectItemType) => {
  editingProject.value = project
}

/** 提交项目（分发新增/更新） */
const handleProjectSubmit = (payload: ProjectSubmitPayload) => {
  if (payload.id) {
    const { id, ...patch } = payload
    projectsApi.update(id, patch)
    editingProject.value = null
  } else {
    projectsApi.add(payload)
  }
}

/** 取消编辑（清空回填，回到新增模式） */
const handleCancelEdit = () => {
  editingProject.value = null
}
</script>

<style scoped lang="scss">
@use "../../styles/index.scss";
</style>
