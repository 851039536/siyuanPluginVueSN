<template>
  <BaseUnitConverter
    :units="DATA_UNITS"
    default-from="byte"
    default-to="kilobyte"
  />
</template>

<script setup lang="ts">
import BaseUnitConverter from './BaseUnitConverter.vue'
import { DATA_UNITS } from '../utils/units'
</script>
