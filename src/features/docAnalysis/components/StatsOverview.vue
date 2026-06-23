<template>
  <div class="stats-overview">
    <div
      v-if="collapsible"
      class="stats-header"
      :class="{ collapsed: isCollapsed }"
      @click="toggleCollapse"
    >
      <div class="header-left">
        <Icon
          :icon="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'"
          class="collapse-icon"
        />
        <span class="stats-title">文档统计概览</span>
      </div>
      <button
        class="analyze-btn"
        :disabled="loading"
        @click.stop="$emit('analyze')"
      >
        <Icon
          :icon="loading ? 'mdi:loading' : 'mdi:chart-bar'"
          :class="{ 'spin-icon': loading }"
        />
        {{ loading ? '分析中...' : '分析' }}
      </button>
    </div>

    <template v-if="hasAnalyzed && (!isCollapsed || !collapsible)">
      <!-- Hero：总文档 + 健康度 -->
      <div class="stats-hero">
        <div class="hero-left">
          <span class="hero-value">{{ stats.totalDocs }}</span>
          <span class="hero-label">总文档</span>
        </div>
        <div class="hero-right">
          <span class="hero-health-label">健康度</span>
          <div
            class="hero-health-bar"
            :title="healthTooltip"
          >
            <div
              class="hero-health-fill"
              :style="{ width: `${healthPct}%` }"
            ></div>
          </div>
          <span
            class="hero-health-value"
            :title="healthTooltip"
          >{{ healthPct }}%</span>
          <span
            class="hero-health-info"
            :title="healthTooltip"
          >
            <Icon icon="mdi:information-outline" />
          </span>
        </div>
      </div>

      <!-- 问题摘要条 -->
      <div
        v-if="hasIssues"
        class="issue-bar"
      >
        <div
          v-if="stats.zeroByteDocs"
          class="issue-item critical"
          @click="$emit('selectCategory', '0B')"
        >
          <span class="issue-value">{{ stats.zeroByteDocs }}</span>
          <span class="issue-label">0B空</span>
        </div>
        <div
          v-if="stats.duplicateNameDocs"
          class="issue-item warn"
          @click="$emit('selectCategory', 'duplicate')"
        >
          <span class="issue-value">{{ stats.duplicateNameDocs }}</span>
          <span class="issue-label">重名</span>
        </div>
        <div
          v-if="stats.pendingPublishDocs"
          class="issue-item accent"
          @click="$emit('selectCategory', 'pendingPublish')"
        >
          <span class="issue-value">{{ stats.pendingPublishDocs }}</span>
          <span class="issue-label">待发布</span>
        </div>
        <div
          v-if="stats.orphanDocs"
          class="issue-item critical"
          @click="$emit('selectCategory', 'orphanDoc')"
        >
          <span class="issue-value">{{ stats.orphanDocs }}</span>
          <span class="issue-label">孤文档</span>
        </div>
      </div>

      <!-- 大小分布 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('size')"
        >
          <Icon
            :icon="isSectionCollapsed('size') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:harddisk" />大小分布
          <button
            class="toolbar-btn"
            :class="{ active: hideZero }"
            title="隐藏零值卡片"
            @click.stop="hideZero = !hideZero"
          >
            <Icon
              :icon="hideZero ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
              :size="13"
            />
            {{ hideZero ? '已隐藏' : '隐藏零值' }}
          </button>
        </div>
        <div
          v-show="!isSectionCollapsed('size')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.zeroByteDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === '0B' }"
            @click="$emit('selectCategory', '0B')"
          >
            <span class="card-value zero">{{ stats.zeroByteDocs }}</span>
            <span class="card-unit">0B空</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.zeroByteDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.smallDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'small' }"
            @click="$emit('selectCategory', 'small')"
          >
            <span class="card-value small">{{ stats.smallDocs }}</span>
            <span class="card-unit">&lt;1KB</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.smallDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.mediumDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'medium' }"
            @click="$emit('selectCategory', 'medium')"
          >
            <span class="card-value medium">{{ stats.mediumDocs }}</span>
            <span class="card-unit">1~10KB</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.mediumDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.largeDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'large' }"
            @click="$emit('selectCategory', 'large')"
          >
            <span class="card-value time-cyan">{{ stats.largeDocs }}</span>
            <span class="card-unit">10~100KB</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.largeDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.xlargeDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'xlarge' }"
            @click="$emit('selectCategory', 'xlarge')"
          >
            <span class="card-value time-purple">{{ stats.xlargeDocs }}</span>
            <span class="card-unit">&gt;100KB</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.xlargeDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.duplicateNameDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'duplicate' }"
            @click="$emit('selectCategory', 'duplicate')"
          >
            <span class="card-value dup">{{ stats.duplicateNameDocs }}</span>
            <span class="card-unit">重名({{ stats.duplicateNameGroups }}组)</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.duplicateNameDocs) }"
            ></span>
          </div>
        </div>
      </div>

      <!-- 更新时间 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('time')"
        >
          <Icon
            :icon="isSectionCollapsed('time') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:clock-outline" />更新时间
        </div>
        <div
          v-show="!isSectionCollapsed('time')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.updatedIn7Days"
            class="stat-card"
            :class="{ active: activeFilter === '7days' }"
            @click="$emit('selectCategory', '7days')"
          >
            <span class="card-value time-green">{{ stats.updatedIn7Days }}</span>
            <span class="card-unit">7天内</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedIn30Days"
            class="stat-card"
            :class="{ active: activeFilter === '30days' }"
            @click="$emit('selectCategory', '30days')"
          >
            <span class="card-value time-yellow">{{ stats.updatedIn30Days }}</span>
            <span class="card-unit">7~30天</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedIn1To2Months"
            class="stat-card"
            :class="{ active: activeFilter === '1to2month' }"
            @click="$emit('selectCategory', '1to2month')"
          >
            <span class="card-value time-cyan">{{ stats.updatedIn1To2Months }}</span>
            <span class="card-unit">1~2月</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedIn2To3Months"
            class="stat-card"
            :class="{ active: activeFilter === '2to3month' }"
            @click="$emit('selectCategory', '2to3month')"
          >
            <span class="card-value time-orange">{{ stats.updatedIn2To3Months }}</span>
            <span class="card-unit">2~3月</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedOverHalfYear !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'halfYear' }"
            @click="$emit('selectCategory', 'halfYear')"
          >
            <span class="card-value time-red">{{ stats.updatedOverHalfYear }}</span>
            <span class="card-unit">半年+</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'customTime' }"
            @click="$emit('selectCategory', 'customTime')"
          >
            <span class="card-value time-purple"><Icon icon="mdi:calendar-range" /></span>
            <span class="card-unit">自定义</span>
          </div>
        </div>
      </div>

      <!-- 书签 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('bookmark')"
        >
          <Icon
            :icon="isSectionCollapsed('bookmark') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:bookmark-outline" />书签
          <button
            class="bookmark-detail-btn"
            title="查看全部书签"
            @click.stop="$emit('showBookmarkDetails')"
          >
            <Icon
              icon="mdi:format-list-bulleted"
              :size="13"
            />详情
          </button>
        </div>
        <div
          v-show="!isSectionCollapsed('bookmark')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.pendingPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'pendingPublish' }"
            @click="$emit('selectCategory', 'pendingPublish')"
          >
            <span class="card-value pending-color">{{ stats.pendingPublishDocs }}</span>
            <span class="card-unit">待发布</span>
          </div>
          <div
            v-if="!hideZero || stats.publishedDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'published' }"
            @click="$emit('selectCategory', 'published')"
          >
            <span class="card-value published-color">{{ stats.publishedDocs }}</span>
            <span class="card-unit">已发布</span>
          </div>
          <div
            v-if="!hideZero || stats.unusedDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'unused' }"
            @click="$emit('selectCategory', 'unused')"
          >
            <span class="card-value unused-color">{{ stats.unusedDocs }}</span>
            <span class="card-unit">不使用</span>
          </div>
          <div
            v-if="!hideZero || stats.noneBookmarkDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'noneBookmark' }"
            @click="$emit('selectCategory', 'noneBookmark')"
          >
            <span class="card-value none-bookmark-color">{{ stats.noneBookmarkDocs }}</span>
            <span class="card-unit">无</span>
          </div>
          <div
            v-if="!hideZero || stats.bookmarkedDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'hasBookmark' }"
            @click="$emit('selectCategory', 'hasBookmark')"
          >
            <span class="card-value bookmark-color">{{ stats.bookmarkedDocs }}</span>
            <span class="card-unit">有书签</span>
          </div>
          <div
            v-if="!hideZero || stats.noBookmarkDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'noBookmark' }"
            @click="$emit('selectCategory', 'noBookmark')"
          >
            <span class="card-value no-bookmark-color">{{ stats.noBookmarkDocs }}</span>
            <span class="card-unit">无书签</span>
          </div>
        </div>
      </div>

      <!-- 发布状态 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('publish')"
        >
          <Icon
            :icon="isSectionCollapsed('publish') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:cloud-check-outline" />发布状态
          <span
            v-if="isSectionCollapsed('publish')"
            class="section-hint"
          >{{ publishSummary }}</span>
        </div>
        <div
          v-show="!isSectionCollapsed('publish')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.fullPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'fullPublish' }"
            @click="$emit('selectCategory', 'fullPublish')"
          >
            <span class="card-value full-publish-color">{{ stats.fullPublishDocs }}</span>
            <span class="card-unit">完整发布</span>
          </div>
          <div
            v-if="!hideZero || stats.partialPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'partialPublish' }"
            @click="$emit('selectCategory', 'partialPublish')"
          >
            <span class="card-value partial-publish-color">{{ stats.partialPublishDocs }}</span>
            <span class="card-unit">部分发布</span>
          </div>
          <div
            v-if="!hideZero || stats.noPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'noPublish' }"
            @click="$emit('selectCategory', 'noPublish')"
          >
            <span class="card-value no-publish-color">{{ stats.noPublishDocs }}</span>
            <span class="card-unit">未发布</span>
          </div>
        </div>
        <!-- 平台分布柱状图 + 覆盖率指标 -->
        <div
          v-show="!isSectionCollapsed('publish') && platformEntries.length > 0"
          class="platform-distro"
        >
          <div class="platform-distro-title">
            <span>平台分布</span>
            <span class="platform-metrics">
              人均 {{ avgPlatformsPerDoc }} 平台 · 覆盖率 {{ coveragePct }}%
            </span>
          </div>
          <div
            v-for="entry in platformEntries"
            :key="entry.id"
            class="platform-bar-v2"
          >
            <span class="platform-bar-label">{{ entry.name }}</span>
            <div class="platform-bar-track">
              <div
                class="platform-bar-fill"
                :style="{ width: `${entry.pct}%` }"
              ></div>
            </div>
            <span class="platform-bar-count">{{ entry.count }}</span>
          </div>
        </div>
      </div>

      <!-- 字数分布 -->
      <div
        v-if="stats.wordCountDistribution.length > 0"
        class="stat-section"
      >
        <div
          class="section-header"
          @click="toggleSection('wordcount')"
        >
          <Icon
            :icon="isSectionCollapsed('wordcount') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:text-short" />字数分布
          <span
            v-if="isSectionCollapsed('wordcount')"
            class="section-hint"
          >{{ wordCountSummary }}</span>
        </div>
        <div
          v-show="!isSectionCollapsed('wordcount')"
          class="wordcount-chart"
        >
          <div
            v-for="item in stats.wordCountDistribution"
            :key="item.label"
            class="platform-bar-v2"
          >
            <span class="platform-bar-label">{{ item.label }}</span>
            <div class="platform-bar-track">
              <div
                class="platform-bar-fill"
                :style="{ width: `${wcBarPct(item.count)}%` }"
              ></div>
            </div>
            <span class="platform-bar-count">{{ item.count }}</span>
          </div>
        </div>
      </div>

      <!-- 自定义书签 -->
      <div
        v-if="stats.customBookmarkTop.length > 0"
        class="stat-section"
      >
        <div
          class="section-header"
          @click="toggleSection('customBm')"
        >
          <Icon
            :icon="isSectionCollapsed('customBm') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:tag-outline" />书签分类 Top-{{ stats.customBookmarkTop.length }}
        </div>
        <div
          v-show="!isSectionCollapsed('customBm')"
          class="wordcount-chart"
        >
          <div
            v-for="item in stats.customBookmarkTop"
            :key="item.value"
            class="platform-bar-v2"
          >
            <span class="platform-bar-label">{{ item.value }}</span>
            <div class="platform-bar-track">
              <div
                class="platform-bar-fill custom-bm-fill"
                :style="{ width: `${customBmBarPct(item.count)}%` }"
              ></div>
            </div>
            <span class="platform-bar-count">{{ item.count }}</span>
          </div>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="section-divider"></div>

      <!-- 深度分析（合并折叠区：结构 + 内容质量 + 引用拓扑 + 深度分布） -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('advanced')"
        >
          <Icon
            :icon="isSectionCollapsed('advanced') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:chart-box-outline" />深度分析
          <span
            v-if="isSectionCollapsed('advanced')"
            class="section-hint"
          >{{ advancedSummary }}</span>
        </div>
        <div
          v-show="!isSectionCollapsed('advanced')"
          class="advanced-grid"
        >
          <!-- 结构 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon
                icon="mdi:sitemap-outline"
                :size="13"
              />结构
            </div>
            <div class="section-cards">
              <div
                v-if="!hideZero || stats.deepDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'deep' }"
                @click="$emit('selectCategory', 'deep')"
              >
                <span class="card-value depth-color">{{ stats.deepDocs }}</span>
                <span class="card-unit">深层≥5</span>
              </div>
              <div
                v-if="!hideZero || stats.imageDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasImage' }"
                @click="$emit('selectCategory', 'hasImage')"
              >
                <span class="card-value img-color">{{ stats.imageDocs }}</span>
                <span class="card-unit">图片({{ stats.totalImages }})</span>
              </div>
            </div>
          </div>

          <!-- 内容质量 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon
                icon="mdi:star-outline"
                :size="13"
              />内容质量
            </div>
            <div class="section-cards">
              <div
                v-if="!hideZero || stats.taggedDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasTag' }"
                @click="$emit('selectCategory', 'hasTag')"
              >
                <span class="card-value time-green">{{ stats.taggedDocs }}</span>
                <span class="card-unit">有标签</span>
              </div>
              <div
                v-if="!hideZero || stats.taggedDocs !== stats.totalDocs"
                class="stat-card"
                :class="{ active: activeFilter === 'noTag' }"
                @click="$emit('selectCategory', 'noTag')"
              >
                <span class="card-value time-red">{{ stats.totalDocs - stats.taggedDocs }}</span>
                <span class="card-unit">无标签</span>
              </div>
              <div
                v-if="!hideZero || stats.aliasedDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasAlias' }"
                @click="$emit('selectCategory', 'hasAlias')"
              >
                <span class="card-value time-cyan">{{ stats.aliasedDocs }}</span>
                <span class="card-unit">有别名</span>
              </div>
              <div
                v-if="!hideZero || stats.memoedDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasMemo' }"
                @click="$emit('selectCategory', 'hasMemo')"
              >
                <span class="card-value time-purple">{{ stats.memoedDocs }}</span>
                <span class="card-unit">有备注</span>
              </div>
            </div>
          </div>

          <!-- 引用拓扑 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon
                icon="mdi:graph-outline"
                :size="13"
              />引用拓扑
            </div>
            <div class="section-cards">
              <div
                v-if="!hideZero || stats.refDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasRef' }"
                @click="$emit('selectCategory', 'hasRef')"
              >
                <span class="card-value ref-color">{{ stats.refDocs }}</span>
                <span class="card-unit">含引用({{ stats.totalRefs }})</span>
              </div>
              <div
                v-if="!hideZero || stats.incomingRefDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'incomingRef' }"
                @click="$emit('selectCategory', 'incomingRef')"
              >
                <span class="card-value time-cyan">{{ stats.incomingRefDocs }}</span>
                <span class="card-unit">被引用</span>
              </div>
              <div
                v-if="!hideZero || stats.orphanDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'orphanDoc' }"
                @click="$emit('selectCategory', 'orphanDoc')"
              >
                <span class="card-value zero">{{ stats.orphanDocs }}</span>
                <span class="card-unit">孤文档</span>
              </div>
            </div>
          </div>

          <!-- 深度分布（跨列） -->
          <div
            v-if="depthStats.depthDistribution.length > 0"
            class="advanced-group advanced-group--full"
          >
            <div class="advanced-group-title">
              <Icon
                icon="mdi:chart-bar"
                :size="13"
              />深度分布
              <span class="advanced-group-hint">均 {{ depthStats.avgDepth }} 层 · 最深 {{ depthStats.maxDepth }} 层</span>
            </div>
            <div class="depth-chart-v2">
              <div
                v-for="item in depthStats.depthDistribution"
                :key="item.depth"
                class="depth-bar-v2 depth-bar-clickable"
                @click="$emit('selectDepth', item.depth)"
              >
                <span class="depth-bar-label">{{ item.depth }}</span>
                <div class="depth-bar-track">
                  <div
                    class="depth-bar-fill"
                    :style="{ width: getBarPercent(item.count) }"
                  ></div>
                </div>
                <span class="depth-bar-count">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div
      v-else
      class="stats-placeholder"
    >
      <Icon
        icon="mdi:chart-box-outline"
        class="placeholder-icon"
      />
      <p>点击「分析」查看文档统计</p>
    </div>
  </div>

  <!-- 书签详情弹出面板 -->
  <Teleport to="body">
    <div
      v-if="bookmarkDetailVisible"
      class="bookmark-detail-overlay"
      @click.self="$emit('showBookmarkDetails')"
    >
      <div class="bookmark-detail-panel">
        <div class="bookmark-detail-header">
          <span class="bookmark-detail-title">
            <Icon icon="mdi:bookmark-outline" />
            全部书签
          </span>
          <button
            class="close-btn"
            @click="$emit('showBookmarkDetails')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="bookmark-detail-body">
          <div
            v-if="bookmarkDetailLoading"
            class="bookmark-detail-loading"
          >
            <Icon
              icon="mdi:loading"
              class="spin-icon"
            />
            加载中...
          </div>
          <div
            v-else-if="bookmarkDetails.length === 0"
            class="bookmark-detail-empty"
          >
            <Icon
              icon="mdi:bookmark-off-outline"
              class="empty-icon"
            />
            <p>暂无书签数据</p>
          </div>
          <div
            v-else
            class="bookmark-detail-list"
          >
            <button
              v-for="item in bookmarkDetails"
              :key="item.value"
              class="bookmark-detail-item"
              @click="$emit('selectBookmark', item.value)"
            >
              <div class="bd-item-left">
                <span
                  class="bd-item-name"
                  :title="item.value"
                >{{ item.value || '(空值)' }}</span>
              </div>
              <span class="bd-item-count">{{ item.count }} 篇</span>
              <Icon
                icon="mdi:chevron-right"
                class="bd-item-arrow"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  BookmarkDetail,
  DepthStats,
  DocStats,
} from "../types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  reactive,
  ref,
} from "vue"
import { PLATFORM_META } from "../composables/useDocAnalysis"

interface Props {
  stats: DocStats
  loading: boolean
  hasAnalyzed: boolean
  activeFilter: string
  depthStats: DepthStats
  bookmarkDetails: BookmarkDetail[]
  bookmarkDetailVisible: boolean
  bookmarkDetailLoading: boolean
  collapsible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: true,
})

defineEmits<{
  (e: "analyze"): void
  (e: "selectCategory", category: string): void
  (e: "showBookmarkDetails"): void
  (e: "selectBookmark", bookmark: string): void
  (e: "selectDepth", depth: number): void
}>()

/** 折叠状态 */
const isCollapsed = ref(false)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

/** 隐藏零值卡片 */
const hideZero = ref(false)

/** 分区折叠状态（深度分析默认折叠） */
const collapsedSections = reactive(new Set<string>(["advanced"]))

function toggleSection(key: string) {
  if (collapsedSections.has(key)) {
    collapsedSections.delete(key)
  }
  else {
    collapsedSections.add(key)
  }
}

function isSectionCollapsed(key: string): boolean {
  return collapsedSections.has(key)
}

/** 健康度百分比（0-100） */
const healthPct = computed(() => {
  const total = props.stats.totalDocs
  if (!total) return 100

  const excessDupes = Math.max(0, props.stats.duplicateNameDocs - props.stats.duplicateNameGroups)
  // 无书签但排除 0B 文档（0B 已单独扣分）
  const noBmExclude0B = Math.max(0, props.stats.noBookmarkDocs - props.stats.zeroByteDocs)
  // 深度 > 7
  const depthGt7 = props.depthStats.depthDistribution
    .filter((d) => d.depth > 7)
    .reduce((sum, d) => sum + d.count, 0)
  // 字数 > 2万
  const wcGt20000 = (props.stats.wordCountDistribution || [])
    .filter((d) => d.label === ">2万字")
    .reduce((sum, d) => sum + d.count, 0)

  const issues = props.stats.zeroByteDocs
    + excessDupes
    + props.stats.unusedDocs
    + noBmExclude0B
    + props.stats.partialPublishDocs
    + depthGt7
    + wcGt20000

  return Math.round(((total - Math.min(total, issues)) / total) * 100)
})

/** 健康度计算说明 tooltip */
const healthTooltip = computed(() => {
  const total = props.stats.totalDocs
  if (!total) return "暂无数据"

  const excessDupes = Math.max(0, props.stats.duplicateNameDocs - props.stats.duplicateNameGroups)
  const noBmExclude0B = Math.max(0, props.stats.noBookmarkDocs - props.stats.zeroByteDocs)
  const depthGt7 = props.depthStats.depthDistribution
    .filter((d) => d.depth > 7)
    .reduce((sum, d) => sum + d.count, 0)
  const wcGt20000 = (props.stats.wordCountDistribution || [])
    .filter((d) => d.label === ">2万字")
    .reduce((sum, d) => sum + d.count, 0)

  const issues = props.stats.zeroByteDocs
    + excessDupes
    + props.stats.unusedDocs
    + noBmExclude0B
    + props.stats.partialPublishDocs
    + depthGt7
    + wcGt20000

  const healthy = Math.max(0, total - Math.min(total, issues))
  return [
    `健康文档 ${healthy} / ${total}`,
    `扣分项:`,
    `  0B空 ${props.stats.zeroByteDocs}`,
    `  重名超出 ${excessDupes}`,
    `  不使用 ${props.stats.unusedDocs}`,
    `  无书签(排除0B) ${noBmExclude0B}`,
    `  部分发布 ${props.stats.partialPublishDocs}`,
    `  深度>7 ${depthGt7}`,
    `  字数>2万 ${wcGt20000}`,
  ].join("\n")
})

/** 是否有问题项需要显示 */
const hasIssues = computed(() =>
  props.stats.zeroByteDocs > 0 || props.stats.duplicateNameDocs > 0
  || props.stats.pendingPublishDocs > 0 || props.stats.orphanDocs > 0,
)

/** 深度分析折叠时的摘要文本 */
const advancedSummary = computed(() => {
  const parts: string[] = []
  if (props.stats.deepDocs) parts.push(`深层 ${props.stats.deepDocs}`)
  if (props.stats.imageDocs) parts.push(`有图 ${props.stats.imageDocs}`)
  if (props.stats.taggedDocs) parts.push(`有标签 ${props.stats.taggedDocs}`)
  if (props.stats.orphanDocs) parts.push(`孤文档 ${props.stats.orphanDocs}`)
  if (props.depthStats.avgDepth) parts.push(`均深 ${props.depthStats.avgDepth}`)
  return parts.join(" · ")
})

/** 发布状态折叠时的摘要文本 */
const publishSummary = computed(() => {
  const parts: string[] = []
  if (props.stats.fullPublishDocs) parts.push(`完整 ${props.stats.fullPublishDocs}`)
  if (props.stats.partialPublishDocs) parts.push(`部分 ${props.stats.partialPublishDocs}`)
  if (props.stats.noPublishDocs) parts.push(`未发布 ${props.stats.noPublishDocs}`)
  return parts.length > 0 ? parts.join(" · ") : ""
})

/** 平台分布柱状图数据（按发布数降序） */
const platformEntries = computed(() => {
  // PLATFORM_META 在运行时通过统计注入，这里从 stats.platformCounts 推导
  const counts = props.stats.platformCounts || {}
  const entries = Object.entries(counts)
    .map(([id, count]) => {
      // 从 PLATFORM_META 查找名称（静态导入会循环，直接用 id 推导）
      const meta = PLATFORM_META.find((p) => p.id === id)
      return {
        id,
        name: meta?.name || id,
        count,
      }
    })
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
  const max = Math.max(...entries.map((e) => e.count), 1)
  return entries.map((e) => ({
    ...e,
    pct: Math.round((e.count / max) * 100),
  }))
})

/** 进入发布体系的文档数（有任一平台发布属性） */
const docsInSystem = computed(() => props.stats.fullPublishDocs + props.stats.partialPublishDocs)

/** 平均每文档发布平台数 */
const avgPlatformsPerDoc = computed(() => {
  if (docsInSystem.value === 0) return "0"
  const total = Object.values(props.stats.platformCounts || {}).reduce((a, b) => a + b, 0)
  return (total / docsInSystem.value).toFixed(1)
})

/** 发布覆盖率：有任一平台发布的文档占总文档比例 */
const coveragePct = computed(() => {
  if (!props.stats.totalDocs) return 0
  return Math.round((docsInSystem.value / props.stats.totalDocs) * 100)
})

/** 字数分布折叠摘要 */
const wordCountSummary = computed(() => {
  const dist = props.stats.wordCountDistribution || []
  if (dist.length === 0) return ""
  return dist.map((d) => `${d.label.split("字")[0]} ${d.count}`).join(" · ")
})

/** 字数分布柱状图最大计数 */
const maxWordCount = computed(() => {
  const counts = (props.stats.wordCountDistribution || []).map((d) => d.count)
  return Math.max(...counts, 1)
})

function wcBarPct(count: number): number {
  return Math.round((count / maxWordCount.value) * 100)
}

/** 自定义书签柱状图最大计数 */
const maxCustomBm = computed(() => {
  const counts = (props.stats.customBookmarkTop || []).map((d) => d.count)
  return Math.max(...counts, 1)
})

function customBmBarPct(count: number): number {
  return Math.round((count / maxCustomBm.value) * 100)
}

/** 计算卡片百分比进度条宽度 */
function pct(count: number): string {
  if (!props.stats.totalDocs || props.stats.totalDocs === 0) return "0%"
  return `${Math.min(100, Math.round((count / props.stats.totalDocs) * 100))}%`
}

/** 计算深度分布柱状图宽度百分比 */
const maxDepthCount = computed(() => {
  const counts = props.depthStats.depthDistribution.map((d) => d.count)
  return Math.max(...counts, 1)
})

function getBarPercent(count: number): string {
  return `${Math.round((count / maxDepthCount.value) * 100)}%`
}
</script>

<style lang="scss" scoped>
@use "../styles/StatsOverview.scss";
</style>
