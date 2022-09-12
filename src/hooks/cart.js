import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { emitCustomEvent, useBranch, usePromoValidate } from '.'
import { orderTypes } from '../constants'
import {
  configSliceSelectors,
  stateSliceSelectors,
  cartSliceActions,
  cartSliceSelectors
} from '../redux'
import { Cart, getUserAgent } from '../utils'
import useTranslate from './translate'
import { useCartCalculator, useFbConversion } from './queries'
import { sha256 } from 'js-sha256'
import { FBPixel, GoogleTagManager } from '../utils/analytics'
import { useSession } from 'next-auth/client'
import { useGetIpInfoData } from '../hooks'

export const useCartReset = () => {
  const dispatch = useDispatch()

  const resetCart = useCallback(() => {
    dispatch && dispatch(cartSliceActions.reset())
  })

  return { resetCart }
}

export const useCartAddItem = () => {
  const config = useSelector(configSliceSelectors.config)
  const cartItems = useSelector(cartSliceSelectors.items)
  const [session, sessionLoading] = useSession()
  const { cartUpdateData } = useCartUpdateData()

  const { clientIp } = useGetIpInfoData()

  const { isLoading: fbConversionLoading, request: fbConversion } =
    useFbConversion()

  const cartAddItem = useCallback(
    async (item, extraInfo = null) => {
      let _cartItems = JSON.parse(JSON.stringify(cartItems ?? []))
      _cartItems = Cart.addItem(item, _cartItems)
      emitCustomEvent('show-added-to-cart')

      const event_time = Math.floor(Date.now() / 1000)
      const event_id = 'addToCart.' + item?.dishId + '.' + event_time

      if (config?.analytics?.fb_conversion?.access_token ?? null) {
        const fbConversionData = {
          action_source: 'website',
          event_id,
          event_name: 'AddToCart',
          event_time,
          event_source_url: window.sessionStorage.getItem('page_url') ?? '/',
          user_data: {
            client_ip_address: clientIp ?? '127.0.0.1',
            client_user_agent: getUserAgent(navigator),
            em: sha256(session ? session?.user?.email : 'guest')
          },
          custom_data: {
            product_name: item?.name,
            currency: config?.currency,
            value: parseFloat(item?.price ?? 0).toFixed(2)
          }
        }

        const { data, error: fbConversionError } = await fbConversion([
          fbConversionData
        ])

        if (fbConversionError) {
          console.log({ fbConversionError })
        }
      }

      FBPixel.addToCart(
        {
          content_type: 'product',
          contents: [
            {
              id: item?.dishId,
              quantity: item?.quantity ?? 1
            }
          ],
          product_catalog_id: extraInfo?.sub_category_id ?? 0,
          currency: config?.currency,
          value: parseFloat(item?.price ?? 0).toFixed(2)
        },
        event_id
      )

      GoogleTagManager.addToCart()

      return cartUpdateData(_cartItems)
    },
    [cartItems]
  )

  return { cartAddItem }
}

export const useCartRemoveItem = () => {
  const cartItems = useSelector(cartSliceSelectors.items)
  const { cartUpdateData } = useCartUpdateData()

  const cartRemoveItem = useCallback(
    (index) => {
      let _cartItems = JSON.parse(JSON.stringify(cartItems ?? []))
      _cartItems = Cart.removeItem(index, _cartItems)
      return cartUpdateData(_cartItems)
    },
    [cartItems]
  )

  return { cartRemoveItem }
}

export const useCartUpdateItemQuantity = () => {
  const cartItems = useSelector(cartSliceSelectors.items)
  const { cartUpdateData } = useCartUpdateData()

  const cartUpdateItemQuantity = useCallback(
    (quantity, index) => {
      let _cartItems = JSON.parse(JSON.stringify(cartItems ?? []))
      _cartItems = Cart.updateItemQuantity(quantity, index, _cartItems)
      return cartUpdateData(_cartItems)
    },
    [cartItems]
  )

  return { cartUpdateItemQuantity }
}

export const useCartPromo = () => {
  const { t } = useTranslate()
  const config = useSelector(configSliceSelectors.config)
  const currentBranchId = useSelector(stateSliceSelectors.currentBranchId)
  const { cartGetData } = useCartGetData()

  const { isLoading: promoValidateLoading, request: promoValidate } =
    usePromoValidate()

  const cartPromo = useCallback(async (promoData) => {
    const cartData = cartGetData()

    const { data, error: promoValidateError } = await promoValidate(config, {
      restId: config?.restId,
      rest_brId: currentBranchId,
      device_type: 9,
      ...promoData
    })

    return {
      promo: data ? Cart.applyPromo(data, cartData, t) : null,
      error: promoValidateError
    }
  }, [])

  return { cartPromo }
}

export const useCartGetData = () => {
  const config = useSelector(configSliceSelectors.config)
  const currentBranchId = useSelector(stateSliceSelectors.currentBranchId)
  const orderType = useSelector(stateSliceSelectors.orderType)
  const cartItems = useSelector(cartSliceSelectors.items)
  const cartTax = useSelector(cartSliceSelectors.tax)
  const cartDeliveryCharges = useSelector(cartSliceSelectors.deliveryCharges)

  const { data: branchData } = useBranch(
    config?.restId,
    currentBranchId,
    currentBranchId != null
  )

  const rest_branch = useMemo(() => {
    return branchData
      ? branchData.data.restaurant_branches.length > 0
        ? branchData.data.restaurant_branches[0]
        : null
      : null
  }, [branchData])

  const fbr_pos_charges = useMemo(() => {
    return rest_branch?.fbr_pos_charge_enabled &&
      (rest_branch?.fbr_pos_charge_value ?? 0) > 0
      ? rest_branch?.fbr_pos_charge_value
      : 0
  }, [rest_branch])

  const cartGetData = useCallback(
    (__cartItems = null) => {
      let _cartItems = JSON.parse(JSON.stringify(__cartItems ?? cartItems))
      return Cart.calculateTotal(
        _cartItems,
        cartTax,
        orderType == orderTypes['DELIVERY'].type || orderType == 'GLOBAL'
          ? cartDeliveryCharges
          : 0,
        rest_branch?.delivery_charges_threshold ?? 0,
        fbr_pos_charges
      )
    },
    [cartItems]
  )

  return { cartGetData }
}

export const useCartUpdateData = () => {
  const dispatch = useDispatch()
  const { cartGetData } = useCartGetData()

  const cartUpdateData = useCallback((_cartItems) => {
    const cartData = cartGetData(_cartItems)

    dispatch(
      cartSliceActions.set({
        items: _cartItems,
        quantity: cartData.quantity,
        subTotal: cartData.subTotal,
        total: cartData.total,
        tax_amount: cartData.tax_amount
      })
    )

    return cartData
  }, [])

  return { cartUpdateData }
}

export const useCartRefetchData = () => {
  const dispatch = useDispatch()
  const config = useSelector(configSliceSelectors.config)
  const currentBranchId = useSelector(stateSliceSelectors.currentBranchId)
  const orderType = useSelector(stateSliceSelectors.orderType)
  const cartItems = useSelector(cartSliceSelectors.items)
  const cartTax = useSelector(cartSliceSelectors.tax)
  const cartDeliveryCharges = useSelector(cartSliceSelectors.deliveryCharges)

  const { data: branchData } = useBranch(
    config?.restId,
    currentBranchId,
    currentBranchId != null
  )

  const rest_branch = useMemo(() => {
    return branchData
      ? branchData.data.restaurant_branches.length > 0
        ? branchData.data.restaurant_branches[0]
        : null
      : null
  }, [branchData])

  const fbr_pos_charges = useMemo(() => {
    return rest_branch?.fbr_pos_charge_enabled &&
      (rest_branch?.fbr_pos_charge_value ?? 0) > 0
      ? rest_branch?.fbr_pos_charge_value
      : 0
  }, [rest_branch])

  const { isLoading: cartCalculatorLoading, request: cartCalculator } =
    useCartCalculator(config)

  const cartRefetchData = async () => {
    let _cartItems = JSON.parse(JSON.stringify(cartItems ?? []))
    const { data: cartCalculatorData, error: cartCalculatorError } =
      await cartCalculator({ dishes: _cartItems })

    const cartData = Cart.parseCartApiResponse(
      cartCalculatorData,
      _cartItems,
      cartTax,
      orderType == orderTypes['DELIVERY'].type || orderType == 'GLOBAL'
        ? cartDeliveryCharges
        : 0,
      rest_branch?.delivery_charges_threshold ?? 0,
      fbr_pos_charges
    )

    dispatch(
      cartSliceActions.set({
        items: cartData.items,
        quantity: cartData.quantity,
        subTotal: cartData.subTotal,
        total: cartData.total,
        tax_amount: cartData.tax_amount
      })
    )

    return cartData
  }

  return { cartRefetchData }
}
