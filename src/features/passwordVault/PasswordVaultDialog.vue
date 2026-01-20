<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="password-vault-overlay" @click.self="closeDialog">
        <Transition name="scale">
          <div v-if="visible" class="password-vault-dialog">
            <!-- 登录界面 -->
            <div v-if="!isLoggedIn" class="login-container">
              <div class="dialog-header">
                <div class="header-title">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  <span>密码箱</span>
                </div>
                <button class="close-btn" @click="closeDialog">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>

              <div class="login-body">
                <div class="login-icon">🔐</div>
                <h2>请输入主密码</h2>
                <p class="login-hint">{{ isFirstTime ? '首次使用将创建新密码' : '请输入密码以解锁' }}</p>

                <!-- 显示保存的密码提示 -->
                <div v-if="!isFirstTime && passwordHint" class="password-hint-display">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>提示：{{ passwordHint }}</span>
                </div>

                <form @submit.prevent="handleLogin" class="login-form">
                  <div class="password-input-wrapper">
                    <input
                      v-model="loginPassword"
                      :type="showLoginPassword ? 'text' : 'password'"
                      placeholder="请输入密码"
                      class="password-input"
                      ref="loginInputRef"
                      @keyup.esc="closeDialog"
                    />
                    <button type="button" class="toggle-visibility-btn" @click="showLoginPassword = !showLoginPassword">
                      <svg v-if="showLoginPassword" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                      </svg>
                      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>

                  <!-- 首次设置时显示密码提示输入 -->
                  <div v-if="isFirstTime" class="hint-input-group">
                    <button type="button" class="hint-toggle-btn" @click="showHintInput = !showHintInput">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      {{ showHintInput ? '取消密码提示' : '设置密码提示（推荐）' }}
                    </button>
                    <input
                      v-if="showHintInput"
                      v-model="passwordHint"
                      type="text"
                      placeholder="例如：我的生日、最喜欢的颜色等"
                      class="hint-input"
                      maxlength="50"
                    />
                  </div>

                  <div v-if="loginError" class="error-message">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    {{ loginError }}
                  </div>

                  <button type="submit" class="login-btn" :disabled="!loginPassword.trim()">
                    {{ isFirstTime ? '创建密码' : '解锁' }}
                  </button>
                </form>

                <!-- 忘记密码选项 -->
                <div v-if="!isFirstTime" class="forgot-password-section">
                  <button class="forgot-password-btn" @click="showForgotPasswordOptions">
                    忘记密码？
                  </button>
                </div>
              </div>
            </div>

            <!-- 主界面 -->
            <div v-else class="main-container">
              <div class="dialog-header">
                <div class="header-title">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  <h2>密码箱</h2>
                </div>
                <button class="close-btn" @click="closeDialog">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>

              <div class="dialog-body">
                <!-- 分类筛选器 -->
                <div class="category-filter">
                  <div class="category-chips">
                    <button
                      v-for="cat in [{ id: 'all', name: '全部', color: '#6b7280' }, ...categories]"
                      :key="cat.id"
                      class="category-chip"
                      :class="{ active: selectedCategory === cat.id }"
                      :style="{ '--cat-color': cat.color }"
                      @click="selectedCategory = cat.id"
                    >
                      <span class="chip-dot" :style="{ backgroundColor: cat.color }"></span>
                      {{ cat.name }}
                    </button>
                  </div>
                  <button class="manage-categories-btn" @click="openCategoryManager" title="管理类别">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                  </button>
                </div>

                <div class="entries-controls">
                  <div class="search-wrapper">
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <input
                      v-model="searchQuery"
                      type="text"
                      placeholder="搜索名称、账号或描述..."
                      class="search-input"
                    />
                  </div>
                  <div class="action-buttons">
                    <button class="export-btn" @click="exportAllData" title="导出所有数据">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      导出
                    </button>
                    <button class="add-btn" @click="openAddModal">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      添加密码
                    </button>
                  </div>
                </div>

                <div class="entries-grid">
                  <div
                    v-for="entry in filteredEntries"
                    :key="entry.id"
                    class="entry-card"
                  >
                    <div class="entry-header">
                      <div class="entry-title-wrapper">
                        <svg class="entry-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <h3>{{ entry.name }}</h3>
                        <span class="entry-category-tag" :style="{ backgroundColor: getCategoryById(entry.category)?.color + '20', color: getCategoryById(entry.category)?.color }">
                          {{ getCategoryById(entry.category)?.name || '未分类' }}
                        </span>
                      </div>
                      <div class="entry-actions">
                        <button @click="editEntry(entry)" :title="'编辑'">
                          {{ '编辑' }}
                        </button>
                        <button @click="deleteEntry(entry.id)" :title="'删除'">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div class="entry-account">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
                      </svg>
                      {{ entry.account }}
                    </div>
                    <div class="entry-description">
                      {{ entry.description }}
                    </div>
                    <div class="entry-field">
                      <div class="field-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="1.5"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        密码
                      </div>
                      <div class="field-value" @click="copyPassword(entry.password)">
                        <span class="password-mask">{{ showPasswords[entry.id] ? entry.password : '••••••••' }}</span>
                        <div class="action-hint">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5"/>
                          </svg>
                          {{ showPasswords[entry.id] ? '点击复制' : '点击显示' }}
                        </div>
                      </div>
                      <button class="toggle-password-btn" @click.stop="togglePasswordVisibility(entry.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path v-if="!showPasswords[entry.id]" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          <path v-else d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          <circle v-if="!showPasswords[entry.id]" cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div v-if="filteredEntries.length === 0" class="no-entries">
                    {{ searchQuery ? '未找到匹配的条目' : '暂无密码条目，点击添加' }}
                  </div>
                </div>
              </div>

              <div class="dialog-footer">
                <button class="change-password-btn" @click="openChangePasswordModal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  修改密码
                </button>
                <span class="shortcut-hint">Esc 关闭 | Ctrl+K 搜索</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Add/Edit Entry Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showAddModal" class="password-vault-overlay modal-overlay" @click="closeAddModal">
        <Transition name="scale">
          <div v-if="showAddModal" class="password-vault-dialog small" @click.stop>
            <div class="dialog-header">
              <h2>{{ editingEntry ? '编辑密码' : '添加密码' }}</h2>
              <button class="close-btn" @click="closeAddModal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="dialog-body">
              <form @submit.prevent="saveEntry" class="entry-form">
                <div class="form-group">
                  <label>类别</label>
                  <select v-model="entryForm.category" class="form-select" required>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label>名称</label>
                  <input
                    v-model="entryForm.name"
                    type="text"
                    placeholder="请输入名称（如：Google、GitHub等）"
                    required
                  />
                </div>

                <div class="form-group">
                  <label>账号</label>
                  <input
                    v-model="entryForm.account"
                    type="text"
                    placeholder="请输入账号"
                    required
                  />
                </div>

                <div class="form-group">
                  <label>密码</label>
                  <div class="password-input-wrapper">
                    <input
                      v-model="entryForm.password"
                      :type="showFormPassword ? 'text' : 'password'"
                      placeholder="请输入密码"
                      required
                    />
                    <button type="button" class="toggle-visibility-btn" @click="showFormPassword = !showFormPassword">
                      <svg v-if="showFormPassword" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                      </svg>
                      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>描述</label>
                  <textarea
                    v-model="entryForm.description"
                    placeholder="请输入描述信息"
                    rows="3"
                    class="form-textarea"
                  ></textarea>
                </div>

                <div class="form-actions">
                  <button type="button" class="cancel-btn" @click="closeAddModal">
                    取消
                  </button>
                  <button type="submit" class="save-btn">
                    保存
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Category Manager Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showCategoryManager" class="password-vault-overlay modal-overlay" @click="closeCategoryManager">
        <Transition name="scale">
          <div v-if="showCategoryManager" class="password-vault-dialog category-manager" @click.stop>
            <div class="dialog-header">
              <h2>管理类别</h2>
              <button class="close-btn" @click="closeCategoryManager">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="dialog-body">
              <!-- 添加新类别 -->
              <div class="add-category-section">
                <h3>添加新类别</h3>
                <div class="add-category-form">
                  <input
                    v-model="newCategory.name"
                    type="text"
                    placeholder="类别名称"
                    class="category-name-input"
                    maxlength="10"
                  />
                  <div class="color-picker-wrapper">
                    <button
                      v-for="color in presetColors"
                      :key="color"
                      class="color-option"
                      :class="{ selected: newCategory.color === color }"
                      :style="{ backgroundColor: color }"
                      @click="newCategory.color = color"
                    ></button>
                  </div>
                  <button class="add-category-btn" @click="addCategory" :disabled="!newCategory.name.trim()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    添加
                  </button>
                </div>
              </div>

              <!-- 类别列表 -->
              <div class="category-list-section">
                <h3>现有类别</h3>
                <div class="category-list">
                  <div
                    v-for="cat in categories"
                    :key="cat.id"
                    class="category-item"
                  >
                    <span class="category-dot" :style="{ backgroundColor: cat.color }"></span>
                    <span class="category-name">{{ cat.name }}</span>
                    <button
                      v-if="cat.id !== 'default'"
                      class="delete-category-btn"
                      @click="deleteCategory(cat.id)"
                      title="删除类别"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <span v-else class="default-badge">默认</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Change Password Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showChangePasswordModal" class="password-vault-overlay modal-overlay" @click="closeChangePasswordModal">
        <Transition name="scale">
          <div v-if="showChangePasswordModal" class="password-vault-dialog small" @click.stop>
            <div class="dialog-header">
              <h2>修改主密码</h2>
              <button class="close-btn" @click="closeChangePasswordModal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="dialog-body">
              <form @submit.prevent="handleChangePassword" class="change-password-form">
                <div class="form-group">
                  <label>当前密码</label>
                  <div class="password-input-wrapper">
                    <input
                      v-model="oldPassword"
                      :type="showOldPassword ? 'text' : 'password'"
                      placeholder="请输入当前密码"
                      required
                    />
                    <button type="button" class="toggle-visibility-btn" @click="showOldPassword = !showOldPassword">
                      <svg v-if="showOldPassword" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                      </svg>
                      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>新密码</label>
                  <div class="password-input-wrapper">
                    <input
                      v-model="newPassword"
                      :type="showNewPassword ? 'text' : 'password'"
                      placeholder="请输入新密码"
                      required
                      minlength="6"
                    />
                    <button type="button" class="toggle-visibility-btn" @click="showNewPassword = !showNewPassword">
                      <svg v-if="showNewPassword" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                      </svg>
                      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>确认新密码</label>
                  <div class="password-input-wrapper">
                    <input
                      v-model="confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      placeholder="请再次输入新密码"
                      required
                      minlength="6"
                    />
                    <button type="button" class="toggle-visibility-btn" @click="showConfirmPassword = !showConfirmPassword">
                      <svg v-if="showConfirmPassword" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                      </svg>
                      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div v-if="changePasswordError" class="error-message">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  {{ changePasswordError }}
                </div>

                <div class="form-actions">
                  <button type="button" class="cancel-btn" @click="closeChangePasswordModal">
                    取消
                  </button>
                  <button type="submit" class="save-btn" :disabled="!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()">
                    确认修改
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { showMessage } from 'siyuan'
import type { PasswordEntry, PasswordCategory, StoredPasswordEntry } from './types'
import { usePlugin } from '@/main'
import {
  deriveKey,
  encryptPassword,
  decryptPassword,
  hashMasterPassword,
  generateVerifySalt
} from './crypto'

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

// 获取插件实例
const plugin = usePlugin()

// Refs
const loginInputRef = ref<HTMLInputElement | null>(null)

// 存储键
const MASTER_PASSWORD_KEY = 'password-vault-master-password'
const VERIFY_SALT_KEY = 'password-vault-verify-salt'
const ENCRYPTION_SALT_KEY = 'password-vault-encryption-salt'
const ENTRIES_KEY = 'password-vault-entries'
const CATEGORIES_KEY = 'password-vault-categories'
const PASSWORD_HINT_KEY = 'password-vault-hint'

// 状态
const isLoggedIn = ref(false)
const loginPassword = ref('')
const showLoginPassword = ref(false)
const loginError = ref('')
const isFirstTime = ref(false)
const savedHash = ref('')
const encryptionKey = ref<CryptoKey | null>(null)  // 当前会话的加密密钥
const encryptionSalt = ref<string>('')              // 加密盐值
const passwordHint = ref<string>('')                // 密码提示
const showHintInput = ref(false)                    // 是否显示提示输入框

const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const showAddModal = ref(false)
const editingEntry = ref<PasswordEntry | null>(null)
const showFormPassword = ref(false)
const showPasswords = ref<Record<string, boolean>>({})

// 修改密码状态
const showChangePasswordModal = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const changePasswordError = ref('')

const entries = ref<PasswordEntry[]>([])
const categories = ref<PasswordCategory[]>([
  { id: 'default', name: '默认', color: '#6b7280' }
])

const entryForm = reactive({
  category: '',
  name: '',
  account: '',
  password: '',
  description: ''
})

// 类别管理
const showCategoryManager = ref(false)
const newCategory = reactive({
  name: '',
  color: '#3b82f6'
})

// 预设颜色
const presetColors = [
  '#3b82f6', // 蓝色
  '#10b981', // 绿色
  '#f59e0b', // 橙色
  '#ef4444', // 红色
  '#8b5cf6', // 紫色
  '#ec4899', // 粉色
  '#06b6d4', // 青色
  '#84cc16'  // 黄绿色
]

// 加载保存的密码验证信息
async function loadMasterPasswordHash() {
  try {
    const [storedHash, storedVerifySalt, storedEncryptSalt, storedHint] = await Promise.all([
      plugin.loadData(MASTER_PASSWORD_KEY),
      plugin.loadData(VERIFY_SALT_KEY),
      plugin.loadData(ENCRYPTION_SALT_KEY),
      plugin.loadData(PASSWORD_HINT_KEY)
    ])

    if (storedHash && storedVerifySalt && storedEncryptSalt) {
      savedHash.value = storedHash as string
      passwordHint.value = (storedHint as string) || ''
      isFirstTime.value = false
    } else {
      isFirstTime.value = true
    }
  } catch (error) {
    console.error('Failed to load master password:', error)
    isFirstTime.value = true
  }
}

// 处理登录
async function handleLogin() {
  if (!loginPassword.value.trim()) return

  if (isFirstTime.value) {
    // 首次创建密码 - 生成盐值并保存
    const verifySalt = generateVerifySalt()
    const encryptSalt = generateVerifySalt()
    const hash = await hashMasterPassword(loginPassword.value, verifySalt)

    // 保存验证信息和加密盐值
    await Promise.all([
      plugin.saveData(MASTER_PASSWORD_KEY, hash),
      plugin.saveData(VERIFY_SALT_KEY, verifySalt),
      plugin.saveData(ENCRYPTION_SALT_KEY, encryptSalt),
      passwordHint.value ? plugin.saveData(PASSWORD_HINT_KEY, passwordHint.value) : Promise.resolve()
    ])

    savedHash.value = hash
    encryptionSalt.value = encryptSalt
    isFirstTime.value = false
    isLoggedIn.value = true

    // 派生加密密钥
    encryptionKey.value = await deriveKey(loginPassword.value, encryptSalt)

    await loadEntries()
    await loadCategories()
  } else {
    // 验证密码 - 获取保存的盐值
    const [verifySalt, encryptSalt] = await Promise.all([
      plugin.loadData(VERIFY_SALT_KEY),
      plugin.loadData(ENCRYPTION_SALT_KEY)
    ]) as [string, string]

    const hash = await hashMasterPassword(loginPassword.value, verifySalt)

    if (hash === savedHash.value) {
      isLoggedIn.value = true
      loginError.value = ''
      encryptionSalt.value = encryptSalt

      // 派生加密密钥
      encryptionKey.value = await deriveKey(loginPassword.value, encryptSalt)

      await loadEntries()
      await loadCategories()
    } else {
      loginError.value = '密码错误，请重试'
    }
  }
}

// 显示忘记密码选项
async function showForgotPasswordOptions() {
  const options = [
    '查看密码提示',
    '导出所有数据（需要密码）',
    '重置所有数据（⚠️ 危险操作）',
    '取消'
  ]

  const choice = await promptForChoice(
    '忘记密码无法恢复加密数据。请选择：\n\n' +
    '1. 查看密码提示 - 如果设置了提示\n' +
    '2. 导出所有数据 - 登录后可导出备份\n' +
    '3. 重置所有数据 - 清除所有数据重新开始\n' +
    '4. 取消',
    options
  )

  switch (choice) {
    case 0: // 查看密码提示
      if (passwordHint.value) {
        alert(`密码提示：${passwordHint.value}`)
      } else {
        showMessage('未设置密码提示', 3000, 'info')
      }
      break
    case 1: // 导出数据
      showMessage('请先登录后，在主界面点击"导出"按钮备份数据', 4000, 'info')
      break
    case 2: // 重置数据
      await resetAllData()
      break
  }
}

// 简单的选择提示函数
function promptForChoice(message: string, options: string[]): Promise<number | null> {
  return new Promise((resolve) => {
    const choice = prompt(message + '\n\n请输入选项编号 (1-' + options.length + '):')
    if (choice === null) {
      resolve(null)
      return
    }
    const num = parseInt(choice, 10)
    if (num >= 1 && num <= options.length) {
      resolve(num - 1)
    } else {
      resolve(null)
    }
  })
}

// 导出所有数据（JSON格式，明文）
async function exportAllData() {
  if (!entries.value.length) {
    showMessage('没有数据可导出', 2000, 'info')
    return
  }

  try {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      entries: entries.value,
      categories: categories.value
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `password-vault-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showMessage('数据已导出，请妥善保管', 3000, 'info')
  } catch (error) {
    console.error('Export failed:', error)
    showMessage('导出失败', 2000, 'error')
  }
}

// 重置所有数据
async function resetAllData() {
  const confirm1 = prompt('⚠️ 警告：此操作将清除所有数据且无法恢复！\n\n请输入 "确认重置" 以继续：')
  if (confirm1 !== '确认重置') {
    showMessage('已取消重置', 2000, 'info')
    return
  }

  const confirm2 = prompt('最后确认：请再次输入 "我明白后果" 以继续：')
  if (confirm2 !== '我明白后果') {
    showMessage('已取消重置', 2000, 'info')
    return
  }

  try {
    // 清除所有存储的数据
    await Promise.all([
      plugin.saveData(MASTER_PASSWORD_KEY, ''),
      plugin.saveData(VERIFY_SALT_KEY, ''),
      plugin.saveData(ENCRYPTION_SALT_KEY, ''),
      plugin.saveData(PASSWORD_HINT_KEY, ''),
      plugin.saveData(ENTRIES_KEY, ''),
      plugin.saveData(CATEGORIES_KEY, '')
    ])

    // 重置状态
    savedHash.value = ''
    passwordHint.value = ''
    isFirstTime.value = true
    loginPassword.value = ''
    loginError.value = ''

    showMessage('所有数据已清除，请设置新的主密码', 3000, 'info')
  } catch (error) {
    console.error('Reset failed:', error)
    showMessage('重置失败', 2000, 'error')
  }
}

// 打开修改密码弹窗
function openChangePasswordModal() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showOldPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
  changePasswordError.value = ''
  showChangePasswordModal.value = true
}

// 关闭修改密码弹窗
function closeChangePasswordModal() {
  showChangePasswordModal.value = false
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  changePasswordError.value = ''
}

// 处理修改密码
async function handleChangePassword() {
  changePasswordError.value = ''

  // 验证输入
  if (!oldPassword.value.trim() || !newPassword.value.trim() || !confirmPassword.value.trim()) {
    changePasswordError.value = '请填写所有字段'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    changePasswordError.value = '两次输入的新密码不一致'
    return
  }

  if (newPassword.value.length < 6) {
    changePasswordError.value = '新密码至少需要6个字符'
    return
  }

  if (oldPassword.value === newPassword.value) {
    changePasswordError.value = '新密码不能与当前密码相同'
    return
  }

  try {
    // 获取当前验证盐值
    const verifySalt = await plugin.loadData(VERIFY_SALT_KEY) as string
    const oldHash = await hashMasterPassword(oldPassword.value, verifySalt)

    // 验证旧密码
    if (oldHash !== savedHash.value) {
      changePasswordError.value = '当前密码错误'
      return
    }

    // 生成新的盐值和哈希
    const newVerifySalt = generateVerifySalt()
    const newEncryptSalt = generateVerifySalt()
    const newHash = await hashMasterPassword(newPassword.value, newVerifySalt)

    // 使用新密码派生新密钥
    const newKey = await deriveKey(newPassword.value, newEncryptSalt)

    // 使用新密钥重新加密所有条目
    const reEncryptedEntries: StoredPasswordEntry[] = await Promise.all(
      entries.value.map(async (entry) => {
        const { encryptedData, iv } = await encryptPassword(entry.password, newKey)
        return {
          id: entry.id,
          category: entry.category,
          name: entry.name,
          account: entry.account,
          encryptedPassword: encryptedData,
          iv: iv,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: Date.now()
        }
      })
    )

    // 保存所有新数据
    await Promise.all([
      plugin.saveData(MASTER_PASSWORD_KEY, newHash),
      plugin.saveData(VERIFY_SALT_KEY, newVerifySalt),
      plugin.saveData(ENCRYPTION_SALT_KEY, newEncryptSalt),
      plugin.saveData(ENTRIES_KEY, reEncryptedEntries)
    ])

    // 更新状态
    savedHash.value = newHash
    encryptionSalt.value = newEncryptSalt
    encryptionKey.value = newKey

    showMessage('密码修改成功，请记住新密码', 3000, 'info')
    closeChangePasswordModal()
  } catch (error) {
    console.error('Change password failed:', error)
    changePasswordError.value = '密码修改失败，请重试'
  }
}

// 加载条目（解密密码）
async function loadEntries() {
  try {
    const stored = await plugin.loadData(ENTRIES_KEY)
    if (stored && encryptionKey.value) {
      const storedEntries = stored as StoredPasswordEntry[]
      // 解密所有条目的密码
      entries.value = await Promise.all(
        storedEntries.map(async (entry) => ({
          ...entry,
          password: await decryptPassword(entry.encryptedPassword, entry.iv, encryptionKey.value!)
        }))
      )
    } else {
      entries.value = []
    }
  } catch (error) {
    console.error('Failed to load entries:', error)
    entries.value = []
  }
}

// 加载分类
async function loadCategories() {
  try {
    const stored = await plugin.loadData(CATEGORIES_KEY)
    if (stored) {
      categories.value = stored as PasswordCategory[]
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

// 保存条目（加密密码）
async function saveEntries() {
  if (!encryptionKey.value) {
    console.error('No encryption key available')
    return
  }
  try {
    // 加密所有条目的密码后存储
    const storedEntries: StoredPasswordEntry[] = await Promise.all(
      entries.value.map(async (entry) => {
        const { encryptedData, iv } = await encryptPassword(entry.password, encryptionKey.value!)
        return {
          id: entry.id,
          category: entry.category,
          name: entry.name,
          account: entry.account,
          encryptedPassword: encryptedData,
          iv: iv,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        }
      })
    )
    await plugin.saveData(ENTRIES_KEY, storedEntries)
  } catch (error) {
    console.error('Failed to save entries:', error)
  }
}

// 保存分类
async function saveCategories() {
  try {
    await plugin.saveData(CATEGORIES_KEY, categories.value)
  } catch (error) {
    console.error('Failed to save categories:', error)
  }
}

// 过滤条目
const filteredEntries = computed(() => {
  let result = entries.value

  if (selectedCategory.value !== 'all') {
    result = result.filter(entry => entry.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(entry =>
      entry.name.toLowerCase().includes(query) ||
      entry.account.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query)
    )
  }

  return result
})

// 获取分类对象
const getCategoryById = (id: string) => {
  return categories.value.find(c => c.id === id)
}

// 打开添加弹窗
const openAddModal = () => {
  editingEntry.value = null
  entryForm.category = categories.value[0]?.id || ''
  entryForm.name = ''
  entryForm.account = ''
  entryForm.password = ''
  entryForm.description = ''
  showFormPassword.value = false
  showAddModal.value = true
}

// 编辑条目
const editEntry = (entry: PasswordEntry) => {
  editingEntry.value = entry
  entryForm.category = entry.category
  entryForm.name = entry.name
  entryForm.account = entry.account
  entryForm.password = entry.password
  entryForm.description = entry.description
  showFormPassword.value = false
  showAddModal.value = true
}

// 关闭添加弹窗
const closeAddModal = () => {
  showAddModal.value = false
  editingEntry.value = null
}

// 类别管理方法
const openCategoryManager = () => {
  showCategoryManager.value = true
}

const closeCategoryManager = () => {
  showCategoryManager.value = false
  newCategory.name = ''
  newCategory.color = '#3b82f6'
}

const addCategory = async () => {
  if (!newCategory.name.trim()) return

  // 检查是否已存在同名类别
  if (categories.value.some(c => c.name === newCategory.name.trim())) {
    showMessage('类别已存在', 2000, 'error')
    return
  }

  const category: PasswordCategory = {
    id: Date.now().toString(),
    name: newCategory.name.trim(),
    color: newCategory.color
  }

  categories.value.push(category)
  await saveCategories()

  // 重置表单
  newCategory.name = ''
  newCategory.color = presetColors[0]

  showMessage('类别已添加', 2000, 'info')
}

const deleteCategory = async (categoryId: string) => {
  if (categoryId === 'default') {
    showMessage('默认类别不能删除', 2000, 'error')
    return
  }

  // 检查是否有条目使用该类别
  const hasEntries = entries.value.some(e => e.category === categoryId)
  if (hasEntries) {
    showMessage('该类别下有密码条目，无法删除', 2000, 'error')
    return
  }

  if (confirm('确定要删除这个类别吗？')) {
    categories.value = categories.value.filter(c => c.id !== categoryId)
    await saveCategories()

    // 如果当前选中的是被删除的类别，重置为全部
    if (selectedCategory.value === categoryId) {
      selectedCategory.value = 'all'
    }

    showMessage('类别已删除', 2000, 'info')
  }
}

// 保存条目
async function saveEntry() {
  try {
    if (editingEntry.value) {
      // 更新
      const index = entries.value.findIndex(e => e.id === editingEntry.value!.id)
      if (index !== -1) {
        entries.value[index] = {
          ...entries.value[index],
          category: entryForm.category,
          name: entryForm.name,
          account: entryForm.account,
          password: entryForm.password,
          description: entryForm.description,
          updatedAt: Date.now()
        }
      }
    } else {
      // 新增
      const newEntry: PasswordEntry = {
        id: Date.now().toString(),
        category: entryForm.category,
        name: entryForm.name,
        account: entryForm.account,
        password: entryForm.password,
        description: entryForm.description,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      entries.value.push(newEntry)
    }

    await saveEntries()
    closeAddModal()
  } catch (error) {
    console.error('Failed to save entry:', error)
  }
}

// 删除条目
async function deleteEntry(id: string) {
  if (confirm('确定要删除这个密码条目吗？')) {
    entries.value = entries.value.filter(e => e.id !== id)
    delete showPasswords.value[id]
    await saveEntries()
  }
}

// 切换密码可见性
const togglePasswordVisibility = (id: string) => {
  showPasswords.value[id] = !showPasswords.value[id]
}

// 复制密码
const copyPassword = async (password: string) => {
  try {
    await navigator.clipboard.writeText(password)
    showMessage('密码已复制', 2000, 'info')
  } catch (error) {
    showMessage('复制失败', 2000, 'error')
  }
}

// 关闭弹窗
const closeDialog = () => {
  isLoggedIn.value = false
  loginPassword.value = ''
  loginError.value = ''
  // 清除加密密钥和解密后的数据（安全措施）
  encryptionKey.value = null
  encryptionSalt.value = ''
  entries.value = []
  emit('update:visible', false)
  emit('close')
}

// 键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.visible) return

  if (event.key === 'Escape') {
    if (showCategoryManager.value) {
      closeCategoryManager()
    } else if (showAddModal.value) {
      closeAddModal()
    } else {
      closeDialog()
    }
  }

  // Ctrl+K 搜索
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    if (isLoggedIn.value) {
      // 聚焦搜索框
    }
  }
}

// 监听 visible 变化
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadMasterPasswordHash()
    await nextTick()
    if (!isLoggedIn.value) {
      loginInputRef.value?.focus()
    }
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style lang="scss" scoped>
@use './PasswordVaultDialog.scss';
</style>
