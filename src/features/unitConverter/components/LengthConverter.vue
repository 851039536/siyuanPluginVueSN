<template>
  <BaseUnitConverter
    :units="LENGTH_UNITS"
    default-from="meter"
    default-to="centimeter"
  />
</template>

<script setup lang="ts">
import BaseUnitConverter from './BaseUnitConverter.vue'
import { LENGTH_UNITS } from '../utils/units'
</script>
