<template>
  <BaseUnitConverter
    :units="VOLUME_UNITS"
    default-from="cubicMeter"
    default-to="liter"
  />
</template>

<script setup lang="ts">
import BaseUnitConverter from './BaseUnitConverter.vue'
import { VOLUME_UNITS } from '../utils/units'
</script>
