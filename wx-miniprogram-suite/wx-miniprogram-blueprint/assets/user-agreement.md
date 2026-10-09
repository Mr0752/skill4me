> 本文件保存用户协议页面的 WXML 模板源码。使用时将下方代码块内容复制，并重命名为 `terms.wxml`（通常位于 `packageA/pages/terms/terms.wxml`）。

```wxml
<!-- packageA/pages/terms/terms.wxml —— 用户协议模板（参数化） -->
<!-- js 里从 utils/env.js 取：appName/contactEmail/legalEntity/jurisdiction/policyDate/version -->
<view class="doc">
  <view class="title">{{appName}} 用户协议</view>
  <view class="date">生效日期：{{policyDate}}　版本：{{version}}</view>

  <view class="h">一、协议的接受</view>
  <view class="p">1.1 欢迎使用{{appName}}。请您在使用前仔细阅读本协议。注册或使用本服务即表示您已知悉并接受本协议全部条款。</view>

  <view class="h">二、账号与会员</view>
  <view class="p">2.1 会员以「体验版/体验额度」形式提供，具体权益与有效期以购买页面公示为准。</view>
  <view class="p">2.2 您不得利用本服务从事任何违反法律法规的活动。</view>

  <view class="h">三、知识产权</view>
  <view class="p">3.1 本服务及相关内容的知识产权归{{legalEntity}}所有，未经许可不得复制、传播。</view>

  <view class="h">四、免责声明</view>
  <view class="p">4.1 本服务生成的任何内容（含 AI/模板产出）仅供参考，不构成专业意见，最终以您的人工复核为准。</view>

  <view class="h">五、争议解决</view>
  <view class="p">5.1 本协议适用中华人民共和国法律，因本协议产生的争议由{{jurisdiction}}有管辖权的人民法院管辖。</view>

  <view class="h">六、联系我们</view>
  <view class="p">6.1 如有疑问请联系 {{contactEmail}}。</view>

  <view class="footer">Copyright © {{policyDate}} {{legalEntity}}. All Rights Reserved.</view>
</view>
```