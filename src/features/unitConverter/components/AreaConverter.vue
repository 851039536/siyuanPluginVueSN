<template>
  <BaseUnitConverter
    :units="AREA_UNITS"
    default-from="squareMeter"
    default-to="squareCentimeter"
  />
</template>

<script setup lang="ts">
import BaseUnitConverter from './BaseUnitConverter.vue'
import { AREA_UNITS } from '../utils/units'
</script>
